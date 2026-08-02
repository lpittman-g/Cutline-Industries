import { useState } from 'react'

const STREAMERS = [
  { name: 'nova_fps', status: 'live', mpm: 186, game: 'Valorant' },
  { name: 'pixelrift', status: 'live', mpm: 142, game: 'Elden Ring' },
  { name: 'cozyqueue', status: 'idle', mpm: 12, game: 'Hollow Paths' },
  { name: 'aimlab_lex', status: 'live', mpm: 128, game: 'Apex Legends' },
]

export function StreamsPage() {
  const [forced, setForced] = useState<string | null>(null)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Stream Monitor</h1>
          <p>Tracked streamers, velocity, and manual heat triggers for testing.</p>
        </div>
      </div>

      {forced && (
        <div className="chip warn" style={{ marginBottom: '1rem' }}>
          Forced heat spike on @{forced}
        </div>
      )}

      <div className="project-grid">
        {STREAMERS.map((s) => (
          <article key={s.name} className="panel panel-pad">
            <div className={`chip ${s.status === 'live' ? 'ready' : ''}`}>{s.status}</div>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>@{s.name}</h3>
            <p style={{ color: 'var(--muted)' }}>
              {s.game} · {s.mpm} msg/min
            </p>
            <div className="velocity-bar" style={{ ['--v' as string]: `${Math.min(100, s.mpm / 2)}%` }} />
            <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={() => setForced(s.name)}>
              Force heat spike
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
