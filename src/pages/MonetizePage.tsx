import { MONEY_RAILS } from '../data/mega'

export function MonetizePage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Money Stack</h1>
          <p>
            Every major YouTube Partner Program rail plus Cutline off-platform revenue — ads,
            Premium, fans, shopping, sponsors, products, retainers.
          </p>
        </div>
      </div>

      <div className="project-grid">
        {MONEY_RAILS.map((rail) => (
          <article key={rail.id} className="panel pack-card money-card">
            <div className="hashtag-row" style={{ marginBottom: '0.5rem' }}>
              <span className="chip ready">{rail.type}</span>
              <span className="chip draft">{rail.status}</span>
            </div>
            <h3 style={{ marginTop: 0 }}>{rail.name}</h3>
            <p style={{ color: 'var(--muted)' }}>
              {rail.type === 'YPP'
                ? 'Enable in YouTube Studio once YPP qualifies. Track RPM weekly.'
                : rail.type === 'B2B'
                  ? 'Sold via Deal Desk + outreach. Invoice through Stripe.'
                  : 'Own the customer relationship off YouTube for higher margin.'}
            </p>
          </article>
        ))}
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Collection map</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Payout</th>
              <th>Cutline action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ads / Shorts ads / Premium / Fan funding / Shopping</td>
              <td>Google AdSense</td>
              <td>Keep AdSense verified; review RPM</td>
            </tr>
            <tr>
              <td>Direct sponsors + retainers</td>
              <td>Stripe / invoice</td>
              <td>Close in Deal Desk</td>
            </tr>
            <tr>
              <td>Digital products</td>
              <td>Stripe on cutline-industries.studio</td>
              <td>Pay links + product pages</td>
            </tr>
            <tr>
              <td>Affiliate</td>
              <td>Network dashboards</td>
              <td>Tracked links in every description</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
