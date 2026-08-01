import { ADS_DESCRIPTIONS, ADS_HEADLINES } from '../data/mega'

export function AdsLabPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ads Lab</h1>
          <p>
            Google Ads-ready headlines, descriptions, and creative checklist for Cutline Industries
            campaigns pointing at cutline-industries.studio.
          </p>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() =>
              navigator.clipboard.writeText([...ADS_HEADLINES, '', ...ADS_DESCRIPTIONS].join('\n'))
            }
          >
            Copy all copy
          </button>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Headlines (≤30)</h3>
          <div className="clip-list">
            {ADS_HEADLINES.map((h) => (
              <div key={h} className="clip-card" onClick={() => navigator.clipboard.writeText(h)}>
                <div>
                  <h4>{h}</h4>
                  <p>{h.length}/30 characters</p>
                </div>
                <span className="chip ready">copy</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Descriptions (≤90)</h3>
          <div className="clip-list">
            {ADS_DESCRIPTIONS.map((d) => (
              <div key={d} className="clip-card" onClick={() => navigator.clipboard.writeText(d)}>
                <div>
                  <h4 style={{ fontSize: '0.92rem' }}>{d}</h4>
                  <p>{d.length}/90 characters</p>
                </div>
                <span className="chip ready">copy</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Creative checklist</h3>
        <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          <li>Final URL: https://cutline-industries.studio</li>
          <li>Square image + horizontal image uploaded</li>
          <li>Square logo uploaded (Cutline mark)</li>
          <li>Use 8+ headlines and 2+ descriptions for Asset optimization</li>
        </ul>
      </section>
    </div>
  )
}
