import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>industries</span>
          </div>
        </div>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/studio">
            Open studio
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <p className="hero-brand">CUTLINE</p>
          <h2>Cutline Industries — gaming content, cut to ship.</h2>
          <p>
            A gaming media studio that turns long VODs into subscriber-ready YouTube Shorts packs,
            then posts them on Autopilot. Built for volume, retention, and a real channel — not a
            fake dashboard.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/studio">
              Start cutting
            </Link>
            <Link className="btn" to="/autopilot">
              Autopilot
            </Link>
          </div>
          <div className="hero-rail">
            <article>
              <h3>Studio</h3>
              <p>Mark clutch moments, score clips, generate gaming-native titles and hooks.</p>
            </article>
            <article>
              <h3>Packs</h3>
              <p>Build 10–30 Short packs from one session for a week of daily posts.</p>
            </article>
            <article>
              <h3>Autopilot</h3>
              <p>Inbox → FFmpeg cut → YouTube upload. Hands-off after one auth.</p>
            </article>
          </div>
          <p style={{ marginTop: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            cutline-industries.studio
          </p>
        </div>
      </section>
    </div>
  )
}
