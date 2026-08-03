import { useState } from 'react'
import { useCutline } from '../context/cutlineContextObject'
import { formatTime } from '../lib/utils'

export function PacksPage() {
  const { projectClips, projectPacks, generatePack, deletePack, setSelectedClipId } = useCutline()
  const [count, setCount] = useState(10)
  const [theme, setTheme] = useState('Daily ranked Shorts for subscriber growth')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Packs</h1>
          <p>
            Build a posting pack (10–30 Shorts) from your highest-scoring clips. Autopilot can ship a
            pack on a schedule once YouTube auth is done.
          </p>
        </div>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="grid-2">
          <div className="field">
            <label>Shorts in pack</label>
            <input
              type="number"
              min={3}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 10)}
            />
          </div>
          <div className="field">
            <label>Theme</label>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} />
          </div>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => generatePack(Math.min(30, Math.max(3, count)), theme)}
        >
          Generate pack
        </button>
      </section>

      <div className="project-grid">
        {projectPacks.length === 0 ? (
          <div className="panel panel-pad empty">No packs yet. Generate one from your clip library.</div>
        ) : (
          projectPacks.map((pack) => {
            const clips = projectClips.filter((c) => pack.clipIds.includes(c.id))
            return (
              <article key={pack.id} className="panel pack-card">
                <h3>{pack.name}</h3>
                <p style={{ color: 'var(--muted)' }}>{pack.theme}</p>
                <p style={{ color: 'var(--cyan)', marginTop: '0.5rem' }}>
                  {clips.length} Shorts · created {new Date(pack.createdAt).toLocaleString()}
                </p>
                <div className="clip-list" style={{ marginTop: '0.85rem', maxHeight: 220 }}>
                  {clips.map((c) => (
                    <div
                      key={c.id}
                      className="clip-card"
                      onClick={() => setSelectedClipId(c.id)}
                    >
                      <div className="score-ring" style={{ ['--p' as string]: c.score }}>
                        <span>{c.score}</span>
                      </div>
                      <div>
                        <h4>{c.title}</h4>
                        <p>
                          {formatTime(c.start)} → {formatTime(c.end)}
                        </p>
                      </div>
                      <span className={`chip ${c.status}`}>{c.status}</span>
                    </div>
                  ))}
                </div>
                <div className="btn-row" style={{ marginTop: '0.85rem' }}>
                  <button className="btn btn-danger" type="button" onClick={() => deletePack(pack.id)}>
                    Delete pack
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
