import { useEffect, useMemo, useState } from 'react'
import { SPRINT_73H, SPRINT_TARGETS } from '../data/sprint73'

const START_KEY = 'cutline.sprint73.start'
const DONE_KEY = 'cutline.sprint73.done'

function loadDone(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

export function Sprint73Page() {
  const [startMs, setStartMs] = useState<number | null>(() => {
    const raw = localStorage.getItem(START_KEY)
    return raw ? Number(raw) : null
  })
  const [done, setDone] = useState<Record<string, boolean>>(loadDone)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    localStorage.setItem(DONE_KEY, JSON.stringify(done))
  }, [done])

  const elapsedH = startMs ? (now - startMs) / 3_600_000 : 0
  const remainingH = startMs ? Math.max(0, 73 - elapsedH) : 73
  const progress = startMs ? Math.min(100, Math.round((elapsedH / 73) * 100)) : 0

  const totalTasks = useMemo(
    () => SPRINT_73H.reduce((n, b) => n + b.tasks.length, 0),
    [],
  )
  const doneCount = Object.values(done).filter(Boolean).length

  function startSprint() {
    const ts = Date.now()
    localStorage.setItem(START_KEY, String(ts))
    setStartMs(ts)
  }

  function toggle(taskId: string) {
    setDone((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>73-Hour Money Sprint</h1>
          <p>
            Cash first via Stripe + outreach. AdSense + Shorts build the flywheel. YPP can follow —
            don&apos;t wait on it to get paid.
          </p>
        </div>
        <div className="btn-row">
          {!startMs ? (
            <button className="btn btn-primary" type="button" onClick={startSprint}>
              Start 73-hour clock
            </button>
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => {
                localStorage.removeItem(START_KEY)
                setStartMs(null)
              }}
            >
              Reset clock
            </button>
          )}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Hours left</div>
          <div className="value lime">{remainingH.toFixed(1)}h</div>
        </div>
        <div className="panel stat">
          <div className="label">Sprint progress</div>
          <div className="value cyan">{progress}%</div>
        </div>
        <div className="panel stat">
          <div className="label">Tasks done</div>
          <div className="value">
            {doneCount}/{totalTasks}
          </div>
        </div>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>73h targets</h3>
        <div className="grid-3">
          {SPRINT_TARGETS.map((t) => (
            <div className="card-lite" key={t.label}>
              <h4>{t.label}</h4>
              <p style={{ color: 'var(--lime)' }}>{t.value}</p>
            </div>
          ))}
        </div>
        <div className="sprint-bar" style={{ ['--p' as string]: progress }}>
          <span />
        </div>
      </section>

      <div className="project-grid">
        {SPRINT_73H.map((block) => (
          <article key={block.id} className="panel pack-card">
            <div className="chip ready">{block.hours}</div>
            <h3>{block.title}</h3>
            <p style={{ color: 'var(--cyan)' }}>{block.cashTarget}</p>
            <div className="checklist" style={{ marginTop: '0.75rem' }}>
              {block.tasks.map((task, i) => {
                const id = `${block.id}:${i}`
                return (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={Boolean(done[id])}
                      onChange={() => toggle(id)}
                    />
                    <span>{task}</span>
                  </label>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
