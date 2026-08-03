import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  confirmCheckoutSession,
  formatUsd,
  startPublicRetainerCheckout,
} from '../../lib/thermalApi'

const MRR_OPTIONS = [
  { label: '$750/mo', value: 750 },
  { label: '$1,250/mo', value: 1250 },
  { label: '$2,500/mo', value: 2500 },
]

export function DevelopersPage() {
  const [searchParams] = useSearchParams()
  const [devName, setDevName] = useState('')
  const [gameTitle, setGameTitle] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [monthlyMrr, setMonthlyMrr] = useState(750)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paidNote, setPaidNote] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const paid = searchParams.get('paid')
    if (!sessionId || paid !== '1') return
    void (async () => {
      try {
        const result = await confirmCheckoutSession(sessionId)
        if (result.ok) {
          setPaidNote('Retainer activated — welcome to Thermal Indie Dev Engine.')
        } else {
          setError(`Checkout status: ${result.status ?? 'unknown'}`)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not confirm checkout')
      }
    })()
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setError('Checkout canceled — pick a plan when you are ready.')
    }
  }, [searchParams])

  const handleStart = async () => {
    if (!devName.trim() || !gameTitle.trim()) {
      setError('Studio name and game title are required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const session = await startPublicRetainerCheckout({
        devName: devName.trim(),
        gameTitle: gameTitle.trim(),
        monthlyMrr,
        contactEmail: contactEmail.trim() || undefined,
      })
      window.location.href = session.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setBusy(false)
    }
  }

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Indie Dev Engine</h1>
          <p>Automatic TikTok ad packs from creators playing your game.</p>
        </div>
      </div>

      {paidNote && <p className="chip ready">{paidNote}</p>}
      {error && <p className="chip warn">{error}</p>}

      <section className="dev-demo panel panel-pad">
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Raw VOD vs ad cut</h2>
        <div className="dev-compare">
          <div className="dev-pane">
            <span className="chip">Raw VOD</span>
            <p>Long uncut stream. Heat buried in hours of footage.</p>
          </div>
          <div className="dev-pane hot">
            <span className="chip ready">Thermal ad cut</span>
            <p>AI-captioned Short from the chat spike — wishlist CTA ready.</p>
          </div>
        </div>
      </section>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Start monthly retainer</h2>
        <p style={{ color: 'var(--muted)' }}>
          $750 – $2,500/mo on cutline-industries.studio via Stripe. Continuous TikTok/Shorts packs
          from stream coverage of your game.
        </p>

        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {MRR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={monthlyMrr === opt.value ? 'btn btn-primary' : 'btn'}
              onClick={() => setMonthlyMrr(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            className="btn"
            placeholder="Studio name"
            value={devName}
            onChange={(e) => setDevName(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <input
            className="btn"
            placeholder="Game title"
            value={gameTitle}
            onChange={(e) => setGameTitle(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <input
            className="btn"
            placeholder="Work email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void handleStart()}
          >
            {busy ? 'Redirecting…' : `Start ${formatUsd(monthlyMrr * 100)}/mo retainer`}
          </button>
          <Link className="btn" to="/bounty">
            See heat samples
          </Link>
          <a
            className="btn"
            href="mailto:lpittman@cutline-industries.studio?subject=Thermal%20Indie%20Retainer"
          >
            Email Cutline
          </a>
        </div>
      </section>
    </div>
  )
}
