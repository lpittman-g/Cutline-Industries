import { Link } from 'react-router-dom'
import { MEGA_NORTH_STAR, PLATFORM_MODULES } from '../data/mega'

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>creator os</span>
          </div>
        </div>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/command">
            Enter OS
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <p className="hero-brand">CUTLINE</p>
          <h2>{MEGA_NORTH_STAR.promise}</h2>
          <p>
            Not a single tool — a full gaming creator business machine: Studio, Autopilot, Outreach,
            Ads Lab, Money Stack, Deal Desk, Analytics, and Media Kit under one roof at{' '}
            {MEGA_NORTH_STAR.domain}.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/command">
              Open Command Center
            </Link>
            <Link className="btn" to="/studio">
              Start cutting
            </Link>
            <Link className="btn" to="/monetize">
              Money stack
            </Link>
          </div>
          <div className="hero-rail">
            {PLATFORM_MODULES.slice(0, 6).map((m) => (
              <article key={m.id}>
                <h3>{m.name}</h3>
                <p>{m.blurb}</p>
              </article>
            ))}
          </div>
          <p style={{ marginTop: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {MEGA_NORTH_STAR.tagline} · {MEGA_NORTH_STAR.domain}
          </p>
        </div>
      </section>
    </div>
  )
}
