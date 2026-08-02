const STAGES = ['Lead Identified', 'Sample Sent', 'Retainer Closed'] as const

const LEADS = [
  { game: 'Hollow Paths', studio: 'Northbark Games', stage: 1 },
  { game: 'Neon Circuit', studio: 'Arc Byte', stage: 0 },
  { game: 'Tideforge', studio: 'Saltpixel', stage: 2 },
]

export function DevCrmPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Developer Pipeline</h1>
          <p>Game detection from heat spikes → pitch → retainer.</p>
        </div>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Game detection log</h3>
        <p style={{ color: 'var(--muted)' }}>Hollow Paths · Neon Circuit · Tideforge spotted in high-heat windows.</p>
      </section>

      <div className="project-grid">
        {LEADS.map((l) => (
          <article key={l.game} className="panel panel-pad">
            <h3 style={{ fontFamily: 'var(--font-display)' }}>{l.game}</h3>
            <p style={{ color: 'var(--muted)' }}>{l.studio}</p>
            <p className="chip ready">{STAGES[l.stage]}</p>
            <button type="button" className="btn" style={{ marginTop: '0.5rem' }}>
              Open pitch generator
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
