export function RevenuePage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Revenue</h1>
          <p>Three-tier breakdown + Stripe sync ledger.</p>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Gateway $15</div>
          <div className="value lime">$1,080</div>
        </div>
        <div className="panel stat">
          <div className="label">Bounty $50</div>
          <div className="value cyan">$950</div>
        </div>
        <div className="panel stat">
          <div className="label">Retainer $750+</div>
          <div className="value">$2,250</div>
        </div>
      </div>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Payouts & Stripe sync</h3>
        <ul style={{ color: 'var(--muted)', lineHeight: 1.8, margin: 0, paddingLeft: '1.1rem' }}>
          <li>Completed · $15 unlock · nova_fps clutch · synced</li>
          <li>Completed · $50 bounty · cozyqueue bundle · synced</li>
          <li>Pending · $750 retainer · Northbark Games · awaiting invoice</li>
        </ul>
      </section>
    </div>
  )
}
