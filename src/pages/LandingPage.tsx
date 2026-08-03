import { Link } from 'react-router-dom'
import { AdSlot } from '../components/AdSlot'

export function LandingPage() {
  return (
    <div className="landing thermal-landing">
      <section className="hero thermal-hero">
        <div className="hero-media thermal-heat" aria-hidden="true" />
        <div className="hero-inner">
          <p className="hero-brand">CUTLINE INDUSTRIES</p>
          <h1 className="hero-headline">Tools, terminal, and ops for shipping media products.</h1>
          <p className="hero-support">
            Command center, Mission Control, and creator workflows under one brand — cutline-industries.studio.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/terminal">
              Open terminal
            </Link>
            <Link className="btn" to="/app/dashboard">
              Mission Control
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section thermal-section">
        <h2>Platform</h2>
        <p>
          Cutline Industries runs the public site, internal Creator OS, and operator tools from a single
          repo — not a channel brand.
        </p>
        <Link className="btn btn-primary" to="/os/command">
          Creator OS
        </Link>
      </section>

      <section className="public-section thermal-section">
        <h2>Operator links</h2>
        <div className="tier-grid">
          <article className="tier-row">
            <div className="tier-price">/terminal</div>
            <h3>Command terminal</h3>
            <p>Project terminal alias into the Cutline OS command center.</p>
          </article>
          <article className="tier-row">
            <div className="tier-price">/app</div>
            <h3>Mission Control</h3>
            <p>Dashboard for clips, bounty board, developers, and revenue.</p>
          </article>
          <article className="tier-row">
            <div className="tier-price">/approve</div>
            <h3>Agent approve</h3>
            <p>Phone-friendly approval surface for agent actions.</p>
          </article>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <AdSlot />
        </div>
      </section>
    </div>
  )
}
