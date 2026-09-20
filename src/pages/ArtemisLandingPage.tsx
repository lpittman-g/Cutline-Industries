import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArtemisMark } from '../components/artemis/ArtemisMark'
import { ARTEMIS_COPY, CAPABILITIES } from '../lib/artemis'

function Arrow() {
  return (
    <span className="artemis-cta-arrow" aria-hidden="true">
      →
    </span>
  )
}

function CapabilityIcon({ id }: { id: (typeof CAPABILITIES)[number]['icon'] }) {
  if (id === 'bow') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 12c4-7 12-7 16 0" />
        <path d="M4 12c4 7 12 7 16 0" />
        <path d="M12 5v14" />
        <path d="M12 12h8" />
      </svg>
    )
  }
  if (id === 'orion') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M7 4h8l4 4v12H7z" />
      <path d="M15 4v4h4" />
      <path d="M9 12h8M9 16h8" />
    </svg>
  )
}

export function ArtemisLandingPage() {
  const scrollToCapabilities = () => {
    document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (window.location.hash === '#capabilities') scrollToCapabilities()
  }, [])

  return (
    <div className="artemis-landing">
      <section className="artemis-hero">
        <ArtemisMark size={72} />
        <h1>{ARTEMIS_COPY.name}</h1>
        <p className="artemis-kicker">{ARTEMIS_COPY.kicker}</p>
        <p className="artemis-lede">{ARTEMIS_COPY.description}</p>
        <div className="artemis-hero-actions">
          <Link className="artemis-cta-primary artemis-cta-blue" to="/console?view=chat">
            Enter Artemis <Arrow />
          </Link>
          <button type="button" className="artemis-cta-secondary" onClick={scrollToCapabilities}>
            View Capabilities <Arrow />
          </button>
        </div>
      </section>

      <section id="capabilities" className="artemis-capabilities" aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading" className="visually-hidden">
          Capabilities
        </h2>
        <div className="artemis-capability-stack">
          {CAPABILITIES.map((card) => (
            <Link
              key={card.id}
              className="artemis-capability-row"
              to={
                card.view === 'files'
                  ? '/console?view=files&engine=orion'
                  : card.view === 'memory'
                    ? '/console?view=memory'
                    : '/console?view=chat'
              }
            >
              <span className="artemis-capability-icon">
                <CapabilityIcon id={card.icon} />
              </span>
              <span>
                <strong>{card.name}</strong>
                <em>{card.blurb}</em>
              </span>
              <span className="artemis-capability-chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="artemis-ecosystem" aria-label="Ecosystem">
        <p>{ARTEMIS_COPY.ecosystem}</p>
        <ul>
          <li aria-label="Google">G</li>
          <li aria-label="Microsoft">⊞</li>
          <li aria-label="Slack">#</li>
          <li aria-label="Notion">N</li>
          <li aria-label="Cloud">☁</li>
        </ul>
      </section>

      <p className="artemis-tagline">{ARTEMIS_COPY.footer}</p>
    </div>
  )
}
