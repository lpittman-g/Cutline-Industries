import { useCallback, useEffect, useState } from 'react'
import { fetchStreamers, triggerHeatSpike, type ThermalStreamer } from '../../lib/thermalApi'

export function StreamsPage() {
  const [streamers, setStreamers] = useState<ThermalStreamer[]>([])
  const [forced, setForced] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchStreamers()
      setStreamers(data.streamers)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load streamers')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  async function onForceHeat(s: ThermalStreamer) {
    setBusy(s.id)
    setForced(s.username)
    try {
      await triggerHeatSpike(s.id)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Heat trigger failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Stream Monitor</h1>
          <p>Live Twitch velocity · heat spikes create real clips in the vault.</p>
        </div>
      </div>

      {error && (
        <div className="chip warn" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {forced && (
        <div className="chip warn" style={{ marginBottom: '1rem' }}>
          Heat pipeline triggered for @{forced}
        </div>
      )}

      <div className="project-grid">
        {streamers.map((s) => (
          <article key={s.id} className="panel panel-pad">
            <div className={`chip ${s.is_live ? 'ready' : ''}`}>{s.is_live ? 'live' : 'idle'}</div>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>@{s.username}</h3>
            <p style={{ color: 'var(--muted)' }}>
              {s.game} · {s.current_msg_per_min} msg/min
            </p>
            <div
              className="velocity-bar"
              style={{ ['--v' as string]: `${Math.min(100, s.current_msg_per_min / 2)}%` }}
            />
            <button
              type="button"
              className="btn"
              style={{ marginTop: '0.75rem' }}
              disabled={busy === s.id}
              onClick={() => onForceHeat(s)}
            >
              {busy === s.id ? 'Processing…' : 'Force heat spike'}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
