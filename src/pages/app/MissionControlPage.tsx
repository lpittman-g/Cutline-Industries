import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchMissionControlStatus,
  type MissionControlStatus,
} from '../../lib/thermalApi'

function checkedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'just now'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function MissionControlPage() {
  const [status, setStatus] = useState<MissionControlStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)

    try {
      setStatus(await fetchMissionControlStatus())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mission Control status is unavailable')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(true), 30_000)
    return () => window.clearInterval(interval)
  }, [load])

  const progress = status?.summary.total
    ? Math.round((status.summary.ready / status.summary.total) * 100)
    : 0

  return (
    <div className="mission-progress">
      <header className="page-head">
        <div>
          <span className="mission-eyebrow">Automation / progress</span>
          <h1>Mission Control</h1>
          <p>
            Persistent implementation and production-readiness view for the Thermal operating loop.
          </p>
        </div>
        <div className="btn-row">
          <Link className="btn" to="/os/autopilot">
            Open VOD Autopilot
          </Link>
          <button
            className="btn btn-primary"
            type="button"
            disabled={loading || refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
        </div>
      </header>

      {error ? (
        <section className="mission-alert" role="alert">
          <div>
            <strong>Status refresh failed</strong>
            <p>{error}</p>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Retry
          </button>
        </section>
      ) : null}

      {loading && !status ? (
        <section className="panel panel-pad mission-state" aria-live="polite">
          <span className="mission-pulse" aria-hidden="true" />
          <div>
            <strong>Checking production readiness</strong>
            <p>Reading safe configuration signals from the Cutline API…</p>
          </div>
        </section>
      ) : null}

      {status ? (
        <>
          <section className="mission-summary panel" aria-label="Mission readiness summary">
            <div className="mission-score" style={{ '--progress': `${progress}%` } as CSSProperties}>
              <strong>{progress}%</strong>
              <span>ready</span>
            </div>
            <div className="mission-summary-copy">
              <span className="mission-eyebrow">Production configuration</span>
              <h2>
                {status.summary.ready} of {status.summary.total} phases ready
              </h2>
              <p>
                All {status.summary.implemented} implementation phases are present. Readiness reports
                booleans only; configuration values and credentials remain server-side.
              </p>
              <div className="mission-progress-track" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="mission-updated">
              <span className={error ? 'mission-dot warn' : 'mission-dot'} aria-hidden="true" />
              Checked {checkedAt(status.generatedAt)}
              <small>Auto-refreshes every 30 seconds</small>
            </div>
          </section>

          <div className="mission-layout">
            <main>
              <div className="mission-section-head">
                <div>
                  <span className="mission-eyebrow">Implementation map</span>
                  <h2>Delivery phases</h2>
                </div>
                <span className="chip ready">{status.summary.implemented} implemented</span>
              </div>

              {status.phases.length ? (
                <div className="mission-phase-grid">
                  {status.phases.map((phase, index) => (
                    <article className="panel mission-phase" key={phase.id}>
                      <div className="mission-phase-head">
                        <span className="mission-phase-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className={`chip ${phase.status === 'ready' ? 'ready' : 'draft'}`}>
                          {phase.status === 'ready' ? 'Ready' : 'Needs config'}
                        </span>
                      </div>
                      <h3>{phase.name}</h3>
                      <p>{phase.description}</p>
                      <ul className="mission-checks">
                        {phase.checks.map((check) => (
                          <li key={check.label} className={check.ready ? 'is-ready' : ''}>
                            <span aria-hidden="true">{check.ready ? '✓' : '○'}</span>
                            <span>{check.label}</span>
                            {!check.required ? <small>optional</small> : null}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="panel empty">
                  No implementation phases were returned. Refresh status or check the API.
                </section>
              )}
            </main>

            <aside className="mission-rail">
              <section className="panel panel-pad">
                <span className="mission-eyebrow">Priority queue</span>
                <h2>Next actions</h2>
                {status.nextActions.length ? (
                  <ol className="mission-actions">
                    {status.nextActions.map((action) => (
                      <li key={action.phaseId}>
                        <strong>{action.label}</strong>
                        <span>{action.detail}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mission-all-ready">
                    <span aria-hidden="true">✓</span>
                    <p>
                      <strong>Configuration ready</strong>
                      All required readiness checks are reporting healthy.
                    </p>
                  </div>
                )}
              </section>

              <section className="panel panel-pad">
                <span className="mission-eyebrow">Operational links</span>
                <h2>PR, CI & automation</h2>
                {status.links.length ? (
                  <div className="mission-links">
                    {status.links.map((link) => (
                      <a href={link.href} target="_blank" rel="noreferrer" key={link.id}>
                        <span>
                          <small>{link.kind}</small>
                          <strong>{link.label}</strong>
                        </span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="empty">No operational links are configured.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}
