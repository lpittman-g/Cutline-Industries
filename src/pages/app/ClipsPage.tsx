const QUEUE = [
  { id: 'job_1', title: 'Clutch ace', stage: 'rendering', engine: 'Cutline' },
  { id: 'job_2', title: 'Boss wipe', stage: 'watermarking', engine: 'Cutline' },
  { id: 'job_3', title: 'Rank-up scream', stage: 'upload', engine: 'Cutline' },
]

export function ClipsPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Clip Vault</h1>
          <p>Cutline queue — render, watermark, upload. Stripe link generator next.</p>
        </div>
      </div>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Cutline queue</h3>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--muted)', lineHeight: 1.8 }}>
          {QUEUE.map((j) => (
            <li key={j.id}>
              <strong style={{ color: 'var(--text)' }}>{j.title}</strong> — {j.stage} via {j.engine}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled>
          Generate Stripe payment link
        </button>
      </section>
    </div>
  )
}
