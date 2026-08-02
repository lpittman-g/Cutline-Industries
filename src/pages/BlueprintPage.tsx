import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BLUEPRINT_CADENCE,
  BLUEPRINT_METRICS,
  BLUEPRINT_MISSION,
  BLUEPRINT_NEXT_ACTIONS,
  BLUEPRINT_OFFERS,
  BLUEPRINT_PHASES,
  BLUEPRINT_PILLARS,
  type BlueprintAction,
  type BlueprintItemStatus,
} from '../data/blueprint'

const API = import.meta.env.VITE_CUTLINE_API || 'http://127.0.0.1:8787'

type LiveBlueprint = {
  ok: boolean
  youtube?: {
    authorized: boolean
    channel?: {
      id: string
      title: string
      customUrl?: string
      stats?: { subscriberCount?: string; videoCount?: string; viewCount?: string }
    } | null
    error?: string
  }
  systems?: Array<{ id: string; name: string; status: string; detail: string }>
}

const STATUS_CLASS: Record<BlueprintItemStatus, string> = {
  done: 'ready',
  now: 'warn',
  next: '',
  blocked: 'danger',
}

export function BlueprintPage() {
  const [live, setLive] = useState<LiveBlueprint | null>(null)
  const [actions, setActions] = useState<BlueprintAction[]>(BLUEPRINT_NEXT_ACTIONS)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/blueprint`)
        const data = (await res.json()) as LiveBlueprint
        if (!cancelled) setLive(data)
      } catch {
        if (!cancelled) setLive({ ok: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function cycleAction(id: string) {
    const order: BlueprintItemStatus[] = ['now', 'next', 'done', 'blocked']
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const idx = order.indexOf(a.status)
        return { ...a, status: order[(idx + 1) % order.length] }
      }),
    )
  }

  const channel = live?.youtube?.channel

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Blueprint</h1>
          <p>{BLUEPRINT_MISSION}</p>
        </div>
        <Link className="btn" to="/autopilot">
          Open Autopilot
        </Link>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">YouTube</div>
          <div className="value lime">
            {live?.youtube?.authorized ? (channel ? 'Live' : 'Auth') : '—'}
          </div>
          <p style={{ color: 'var(--muted)', margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
            {channel
              ? `${channel.title} · ${channel.stats?.videoCount || 0} videos · ${channel.stats?.subscriberCount || 0} subs`
              : live?.youtube?.error || 'Connect API to see channel'}
          </p>
        </div>
        <div className="panel stat">
          <div className="label">Phase focus</div>
          <div className="value cyan">0→1</div>
          <p style={{ color: 'var(--muted)', margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
            Foundation done-ish · ship Shorts daily now
          </p>
        </div>
        <div className="panel stat">
          <div className="label">Cash path</div>
          <div className="value">Stripe</div>
          <p style={{ color: 'var(--muted)', margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
            Spark $750 before waiting on YPP
          </p>
        </div>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Four pillars</h3>
        <div className="grid-2">
          {BLUEPRINT_PILLARS.map((p) => (
            <div key={p.id} className="card-lite">
              <h4>{p.name}</h4>
              <p>{p.job}</p>
              <p style={{ color: 'var(--cyan)', fontSize: '0.85rem' }}>{p.modules.join(' · ')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Next actions</h3>
        <p style={{ color: 'var(--muted)' }}>Tap a row to cycle status: now → next → done → blocked</p>
        <div className="checklist">
          {actions.map((a) => (
            <label key={a.id} style={{ cursor: 'pointer' }} onClick={() => cycleAction(a.id)}>
              <span className={`chip ${STATUS_CLASS[a.status]}`} style={{ marginRight: '0.5rem' }}>
                {a.status}
              </span>
              <span>
                {a.title}{' '}
                <span style={{ color: 'var(--muted)' }}>
                  · {a.owner} · {a.eta}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Phases</h3>
          {BLUEPRINT_PHASES.map((phase) => (
            <div key={phase.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <strong style={{ fontFamily: 'var(--font-display)' }}>{phase.name}</strong>
                <span className={`chip ${STATUS_CLASS[phase.status]}`}>{phase.status}</span>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0.25rem 0 0.5rem' }}>{phase.goal}</p>
              <ul style={{ color: 'var(--muted)', margin: 0, paddingLeft: '1.1rem' }}>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <div>
          <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Daily cadence</h3>
            <ul style={{ color: 'var(--muted)', margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7 }}>
              {BLUEPRINT_CADENCE.map((row) => (
                <li key={row.window}>
                  <strong style={{ color: 'var(--text)' }}>{row.window}:</strong> {row.action}{' '}
                  <span style={{ color: 'var(--cyan)' }}>({row.module})</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Offer ladder</h3>
            {BLUEPRINT_OFFERS.map((o) => (
              <div key={o.id} style={{ marginBottom: '0.75rem' }}>
                <strong>
                  {o.name} — {o.price}
                </strong>
                <p style={{ color: 'var(--muted)', margin: '0.2rem 0 0' }}>{o.promise}</p>
              </div>
            ))}
            <Link className="btn" to="/deals">
              Open Deal Desk
            </Link>
          </section>

          <section className="panel panel-pad">
            <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Targets</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>7d</th>
                  <th>30d</th>
                </tr>
              </thead>
              <tbody>
                {BLUEPRINT_METRICS.map((m) => (
                  <tr key={m.metric}>
                    <td>{m.metric}</td>
                    <td>{m.d7}</td>
                    <td>{m.d30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {live?.systems && live.systems.length > 0 && (
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Live systems</h3>
          <div className="grid-2">
            {live.systems.map((s) => (
              <div key={s.id} className="card-lite">
                <h4>
                  {s.name}{' '}
                  <span className={`chip ${s.status === 'live' ? 'ready' : s.status === 'blocked' ? 'danger' : 'warn'}`}>
                    {s.status}
                  </span>
                </h4>
                <p>{s.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
