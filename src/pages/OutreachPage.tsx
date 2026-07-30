import { useMemo, useState } from 'react'
import { DEMO_LEADS, type Lead } from '../data/mega'

const STAGES: Lead['stage'][] = ['new', 'contacted', 'replied', 'call', 'won', 'lost']

export function OutreachPage() {
  const [leads, setLeads] = useState(DEMO_LEADS)
  const [filter, setFilter] = useState<'all' | Lead['stage']>('all')
  const [draft, setDraft] = useState(
    `Hey {{name}} — I cut gaming Shorts packs for brands like yours.\nI can send a free 5-clip sample concept for {{company}} this week.\nWant the pack or a 15-min call?`,
  )

  const visible = useMemo(
    () => (filter === 'all' ? leads : leads.filter((l) => l.stage === filter)),
    [filter, leads],
  )

  function advance(id: string) {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const idx = STAGES.indexOf(l.stage)
        const next = STAGES[Math.min(idx + 1, STAGES.length - 2)] // don't auto-lost
        return { ...l, stage: next }
      }),
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Outreach Engine</h1>
          <p>
            4-week buyer machine: optimize proof → build lists → value-first outreach → secure deals
            for Cutline Industries.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={() => setFilter('all')}>
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              className={`btn ${filter === s ? 'btn-primary' : ''}`}
              type="button"
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Week board</h3>
          <div className="grid-2">
            <div className="card-lite">
              <h4>Week 1 · Profile</h4>
              <p>Banner, media kit, site, Shorts proof live.</p>
            </div>
            <div className="card-lite">
              <h4>Week 2 · Lists</h4>
              <p>50–100 brand/agency/creator leads saved.</p>
            </div>
            <div className="card-lite">
              <h4>Week 3 · Outreach</h4>
              <p>Value-first notes + free sample clip pack.</p>
            </div>
            <div className="card-lite">
              <h4>Week 4 · Close</h4>
              <p>Calls, rate card, Stripe invoice, kickoff.</p>
            </div>
          </div>
        </section>

        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Message template</h3>
          <div className="field">
            <label>Outreach draft</label>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} />
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => navigator.clipboard.writeText(draft)}
          >
            Copy template
          </button>
        </section>
      </div>

      <div className="project-grid" style={{ marginTop: '1rem' }}>
        {visible.map((lead) => (
          <article key={lead.id} className="panel pack-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{lead.name}</h3>
              <div className="score-ring" style={{ ['--p' as string]: lead.score }}>
                <span>{lead.score}</span>
              </div>
            </div>
            <p style={{ color: 'var(--muted)' }}>
              {lead.title} · {lead.company}
            </p>
            <div className="hashtag-row" style={{ margin: '0.55rem 0' }}>
              <span className={`chip ${lead.stage === 'won' ? 'ready' : 'draft'}`}>{lead.stage}</span>
              <span className="chip">{lead.niche}</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{lead.notes}</p>
            <div className="btn-row" style={{ marginTop: '0.75rem' }}>
              <button className="btn btn-primary" type="button" onClick={() => advance(lead.id)}>
                Advance stage
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(
                    draft
                      .split('{{name}}')
                      .join(lead.name.split(' ')[0] ?? lead.name)
                      .split('{{company}}')
                      .join(lead.company),
                  )
                }
              >
                Copy personalized
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
