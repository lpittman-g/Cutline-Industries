import { useState } from 'react'
import { DEAL_PACKAGES, DEMO_LEADS } from '../data/mega'

export function DealsPage() {
  const [pipeline] = useState(
    DEMO_LEADS.filter((l) => ['replied', 'call', 'won'].includes(l.stage)),
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Deal Desk</h1>
          <p>
            Sponsor packages, retainers, and close pipeline for Cutline Industries — from sample
            pack to Stripe invoice.
          </p>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        {DEAL_PACKAGES.map((pack) => (
          <article key={pack.id} className="panel pack-card">
            <h3 style={{ marginTop: 0 }}>{pack.name}</h3>
            <div className="value lime" style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>
              {pack.price}
            </div>
            <ul style={{ color: 'var(--muted)', paddingLeft: '1.1rem' }}>
              {pack.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  `${pack.name} — ${pack.price}\n` + pack.includes.map((i) => `• ${i}`).join('\n'),
                )
              }
            >
              Copy offer
            </button>
          </article>
        ))}
      </div>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Active pipeline</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Company</th>
              <th>Stage</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {pipeline.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.company}</td>
                <td>
                  <span className={`chip ${l.stage === 'won' ? 'ready' : 'draft'}`}>{l.stage}</span>
                </td>
                <td>{l.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
