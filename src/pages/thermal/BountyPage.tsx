import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { DEMO_BOUNTY_CLIPS } from '../../data/thermal'

export function BountyPage() {
  const [q, setQ] = useState('')
  const clips = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return DEMO_BOUNTY_CLIPS
    return DEMO_BOUNTY_CLIPS.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.streamer.toLowerCase().includes(needle) ||
        c.game.toLowerCase().includes(needle),
    )
  }, [q])

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Bounty Board</h1>
          <p>Live heat feed — watermarked previews. Unlock clean 4K when you’re ready to claim.</p>
        </div>
      </div>

      <label className="bounty-search">
        <span>Search heat</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Streamer, game, or moment…"
        />
      </label>

      <div className="bounty-grid">
        {clips.map((clip) => (
          <article key={clip.id} className="bounty-card">
            <div className="bounty-preview">
              <span className="heat-pill">HEAT {clip.heatScore}</span>
              <span className="wm-label">THERMAL PREVIEW</span>
              <p>
                {clip.msgPerMin} msg/min · {clip.durationSec}s
              </p>
            </div>
            <h3>{clip.title}</h3>
            <p>
              @{clip.streamer} · {clip.game}
            </p>
            <Link className="btn btn-primary" to={`/checkout/${clip.id}`}>
              Unlock Clean 4K Version
            </Link>
          </article>
        ))}
      </div>
      {!clips.length && <p style={{ color: 'var(--muted)' }}>No heat matches that search.</p>}
    </div>
  )
}
