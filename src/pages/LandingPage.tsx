import { Link } from 'react-router-dom'
import { AdSlot } from '../components/AdSlot'

export function LandingPage() {
  return (
    <div className="landing">
      <section className="hero public-hero">
        <div className="hero-media" aria-hidden="true">
          <img src="/cutline-logo.png" alt="" className="hero-logo-bg" />
        </div>
        <div className="hero-inner">
          <p className="hero-brand">CUTLINE</p>
          <h1 className="hero-headline">Gaming footage, cut into Shorts that ship.</h1>
          <p className="hero-support">
            Cutline Industries is a gaming media studio — turning VODs into YouTube Shorts and
            sponsor-ready packs for channels that need volume.
          </p>
          <div className="hero-actions">
            <a
              className="btn btn-primary"
              href="https://www.youtube.com/@lamontpittman-f4q"
              target="_blank"
              rel="noreferrer"
            >
              Watch on YouTube
            </a>
            <Link className="btn" to="/deals">
              Work with us
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section">
        <h2>What we ship</h2>
        <p>
          Vertical Shorts from gameplay, titles and hooks that land in the first second, and sponsor
          packages brands can buy without a long pitch cycle.
        </p>
        <div className="public-cta-row">
          <Link className="btn" to="/work">
            See the work
          </Link>
          <Link className="btn" to="/media-kit">
            Media kit
          </Link>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <AdSlot />
        </div>
      </section>
    </div>
  )
}
