import { Link } from 'react-router-dom'
import { AdSlot } from '../components/AdSlot'
import { THERMAL, THERMAL_TIERS } from '../data/thermal'

export function LandingPage() {
  return (
    <div className="landing thermal-landing">
      <section className="hero thermal-hero">
        <div className="hero-media thermal-heat" aria-hidden="true" />
        <div className="hero-inner">
          <p className="hero-brand">CUTLINE INDUSTRIES</p>
          <h1 className="hero-headline">Turn live stream heat into instant revenue.</h1>
          <p className="hero-support">
            Thermal converts chat spikes into Shorts in seconds — unlocks for streamers, bounty clips
            for fans, ad packs for indie game studios.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={THERMAL.discordBotUrl} target="_blank" rel="noreferrer">
              {THERMAL.discordBotCta}
            </a>
            <Link className="btn" to="/bounty">
              Open Bounty Board
            </Link>
          </div>
          <p className="thermal-demo-note">Demo: chat spike → Short conversion in ~30 seconds</p>
        </div>
      </section>

      <section className="public-section thermal-section">
        <h2>Indie Dev Showcase</h2>
        <p>
          Creators playing your game generate TikTok/Shorts heat. Thermal packages those moments into
          wishlist-driving ad packs — built on Cutline cutting under the hood.
        </p>
        <Link className="btn btn-primary" to="/developers">
          For game developers
        </Link>
      </section>

      <section className="public-section thermal-section">
        <h2>Pricing & tiers</h2>
        <div className="tier-grid">
          {THERMAL_TIERS.map((t) => (
            <article key={t.tier} className="tier-row">
              <div className="tier-price">{t.pricing}</div>
              <h3>{t.target}</h3>
              <p>{t.description}</p>
            </article>
          ))}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <AdSlot />
        </div>
      </section>
    </div>
  )
}
