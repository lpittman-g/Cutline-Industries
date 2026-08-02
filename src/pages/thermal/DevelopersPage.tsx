import { Link } from 'react-router-dom'

export function DevelopersPage() {
  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Indie Dev Engine</h1>
          <p>Automatic TikTok ad packs from creators playing your game.</p>
        </div>
      </div>

      <section className="dev-demo panel panel-pad">
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Raw VOD vs ad cut</h2>
        <div className="dev-compare">
          <div className="dev-pane">
            <span className="chip">Raw VOD</span>
            <p>Long uncut stream. Heat buried in hours of footage.</p>
          </div>
          <div className="dev-pane hot">
            <span className="chip ready">Thermal ad cut</span>
            <p>AI-captioned Short from the chat spike — wishlist CTA ready.</p>
          </div>
        </div>
      </section>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Retainer onboarding</h2>
        <p style={{ color: 'var(--muted)' }}>
          Book a monthly pack from $750/mo. Stripe checkout portal wires next — for now claim a sample
          path or talk to us.
        </p>
        <div className="btn-row">
          <a className="btn btn-primary" href="mailto:lpittman@cutline-industries.studio?subject=Thermal%20Indie%20Retainer">
            Start $750/mo retainer
          </a>
          <Link className="btn" to="/bounty">
            See heat samples
          </Link>
        </div>
      </section>
    </div>
  )
}
