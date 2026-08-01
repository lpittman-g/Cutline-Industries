import { DEAL_PACKAGES, MEGA_NORTH_STAR } from '../data/mega'

export function MediaKitPage() {
  const kit = [
    `CUTLINE INDUSTRIES MEDIA KIT`,
    ``,
    `${MEGA_NORTH_STAR.tagline}`,
    `Domain: ${MEGA_NORTH_STAR.domain}`,
    ``,
    `WHAT WE DO`,
    MEGA_NORTH_STAR.promise,
    ``,
    `PACKAGES`,
    ...DEAL_PACKAGES.flatMap((p) => [
      `${p.name} — ${p.price}`,
      ...p.includes.map((i) => `  - ${i}`),
      ``,
    ]),
    `CONTACT`,
    `Lamont R Pittman · Cutline Industries`,
    `cutline-industries.studio`,
  ].join('\n')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Media Kit</h1>
          <p>Sponsor-ready kit generated from Cutline packages and positioning.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" type="button" onClick={() => navigator.clipboard.writeText(kit)}>
            Copy media kit
          </button>
        </div>
      </div>

      <section className="panel panel-pad media-kit-preview">
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>industries</span>
          </div>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>{MEGA_NORTH_STAR.tagline}</h2>
        <p style={{ color: 'var(--muted)', maxWidth: '60ch' }}>{MEGA_NORTH_STAR.promise}</p>

        <div className="grid-3" style={{ marginTop: '1rem' }}>
          {DEAL_PACKAGES.map((p) => (
            <article key={p.id} className="card-lite">
              <h3>
                {p.name}
                <span style={{ display: 'block', color: 'var(--lime)', fontSize: '1.1rem' }}>
                  {p.price}
                </span>
              </h3>
              <ul style={{ color: 'var(--muted)', paddingLeft: '1rem' }}>
                {p.includes.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <pre
          style={{
            marginTop: '1.25rem',
            whiteSpace: 'pre-wrap',
            color: 'var(--muted)',
            fontSize: '0.8rem',
          }}
        >
          {kit}
        </pre>
      </section>
    </div>
  )
}
