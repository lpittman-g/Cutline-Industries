import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArtemisMark } from '../components/artemis/ArtemisMark'
import { ARTEMIS_COPY, CAPABILITIES } from '../lib/artemis'

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
        <div className="artemis-hero-copy">
          <div className="artemis-hero-name">
            <ArtemisMark size={44} />
            <h1>{ARTEMIS_COPY.name}</h1>
          </div>
          <p className="artemis-kicker">{ARTEMIS_COPY.kicker}</p>
          <p className="artemis-lede">{ARTEMIS_COPY.description}</p>
          <div className="artemis-hero-actions">
            <Link className="artemis-cta-primary" to="/console?view=chat">
              Enter Artemis
            </Link>
            <button type="button" className="artemis-cta-secondary" onClick={scrollToCapabilities}>
              View Capabilities
            </button>
          </div>
        </div>
      </section>

      <section id="capabilities" className="artemis-capabilities" aria-labelledby="capabilities-heading">
        <p className="artemis-section-kicker">Capabilities</p>
        <h2 id="capabilities-heading">Three systems. One interface.</h2>
        <div className="artemis-capability-grid">
          {CAPABILITIES.map((card) => (
            <Link
              key={card.id}
              className="artemis-capability-card"
              to={card.view === 'files' ? '/console?view=files&engine=orion' : '/console?view=chat'}
            >
              <span className="artemis-capability-hint">{card.hint}</span>
              <h3>{card.name}</h3>
              <p>{card.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
