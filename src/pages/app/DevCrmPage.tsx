import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createDeveloper,
  createRetainerCheckout,
  fetchDeveloperPipeline,
  fetchDevelopers,
  formatMrr,
  retainerStatusLabel,
  updateDeveloper,
  type ThermalPipelineCount,
  type ThermalRetainer,
  type ThermalRetainerStatus,
} from '../../lib/thermalApi'

const STATUSES: ThermalRetainerStatus[] = ['prospect', 'sample_sent', 'active', 'cancelled']

const NEXT_STATUS: Partial<Record<ThermalRetainerStatus, ThermalRetainerStatus>> = {
  prospect: 'sample_sent',
  sample_sent: 'active',
}

export function DevCrmPage() {
  const [developers, setDevelopers] = useState<ThermalRetainer[]>([])
  const [pipeline, setPipeline] = useState<ThermalPipelineCount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [devName, setDevName] = useState('')
  const [gameTitle, setGameTitle] = useState('')
  const [monthlyMrr, setMonthlyMrr] = useState('750')
  const [contactEmail, setContactEmail] = useState('')

  const load = async () => {
    try {
      const [devData, pipeData] = await Promise.all([
        fetchDevelopers(),
        fetchDeveloperPipeline(),
      ])
      setDevelopers(devData.developers)
      setPipeline(pipeData.pipeline)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Developer CRM unavailable')
    }
  }

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [])

  const handleCreate = async () => {
    if (!devName.trim() || !gameTitle.trim()) return
    try {
      await createDeveloper({
        devName: devName.trim(),
        gameTitle: gameTitle.trim(),
        monthlyMrr: Number(monthlyMrr) || 750,
        contactEmail: contactEmail.trim() || undefined,
        status: 'prospect',
      })
      setDevName('')
      setGameTitle('')
      setMonthlyMrr('750')
      setContactEmail('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const handleAdvance = async (row: ThermalRetainer) => {
    const next = NEXT_STATUS[row.status as ThermalRetainerStatus]
    if (!next) return
    setBusyId(row.id)
    try {
      await updateDeveloper(row.id, { status: next })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleCheckout = async (row: ThermalRetainer) => {
    setBusyId(row.id)
    try {
      const session = await createRetainerCheckout(row.id, Number(row.monthly_mrr))
      window.location.href = session.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setBusyId(null)
    }
  }

  const handleCancel = async (row: ThermalRetainer) => {
    if (!confirm(`Cancel retainer for ${row.game_title}?`)) return
    setBusyId(row.id)
    try {
      await updateDeveloper(row.id, { status: 'cancelled' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Developer Pipeline</h1>
          <p>Tier 3 Indie Dev Wishlist Engine — prospect → sample → Stripe retainer.</p>
        </div>
        <Link className="btn" to="/developers" target="_blank" rel="noreferrer">
          Public pitch ↗
        </Link>
      </div>

      {error && <p className="chip warn">{error}</p>}

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Pipeline</h3>
        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {pipeline.map((p) => (
            <span key={p.status} className="chip">
              {retainerStatusLabel(p.status)} · {p.count}
            </span>
          ))}
        </div>
      </section>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Add prospect</h3>
        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            className="btn"
            placeholder="Studio name"
            value={devName}
            onChange={(e) => setDevName(e.target.value)}
            style={{ minWidth: 160 }}
          />
          <input
            className="btn"
            placeholder="Game title"
            value={gameTitle}
            onChange={(e) => setGameTitle(e.target.value)}
            style={{ minWidth: 160 }}
          />
          <input
            className="btn"
            placeholder="MRR USD"
            value={monthlyMrr}
            onChange={(e) => setMonthlyMrr(e.target.value)}
            style={{ width: 100 }}
          />
          <input
            className="btn"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <button type="button" className="btn btn-primary" onClick={() => void handleCreate()}>
            Add lead
          </button>
        </div>
      </section>

      <div className="project-grid">
        {developers.map((row) => (
          <article key={row.id} className="panel panel-pad">
            <h3 style={{ fontFamily: 'var(--font-display)' }}>{row.game_title}</h3>
            <p style={{ color: 'var(--muted)' }}>{row.dev_name}</p>
            <p className="chip ready">{retainerStatusLabel(row.status)}</p>
            <p style={{ margin: '0.5rem 0' }}>{formatMrr(row.monthly_mrr)}</p>
            {row.contact_email && (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{row.contact_email}</p>
            )}
            {row.notes && (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{row.notes}</p>
            )}
            <div className="btn-row" style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              {NEXT_STATUS[row.status as ThermalRetainerStatus] && (
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === row.id}
                  onClick={() => void handleAdvance(row)}
                >
                  → {retainerStatusLabel(NEXT_STATUS[row.status as ThermalRetainerStatus]!)}
                </button>
              )}
              {row.status !== 'active' && row.status !== 'cancelled' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === row.id}
                  onClick={() => void handleCheckout(row)}
                >
                  Stripe checkout
                </button>
              )}
              {row.status !== 'cancelled' && (
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === row.id}
                  onClick={() => void handleCancel(row)}
                >
                  Cancel
                </button>
              )}
            </div>
            {STATUSES.includes(row.status as ThermalRetainerStatus) && (
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                #{row.id}
                {row.stripe_subscription_id ? ` · sub ${row.stripe_subscription_id.slice(0, 14)}…` : ''}
              </p>
            )}
          </article>
        ))}
      </div>

      {developers.length === 0 && !error && (
        <p style={{ color: 'var(--muted)' }}>No retainers yet — add a prospect above.</p>
      )}
    </div>
  )
}
