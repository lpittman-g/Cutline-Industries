import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArtemisMark } from '../components/artemis/ArtemisMark'
import { ARTEMIS_COPY, CAPABILITIES } from '../lib/artemis'

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'You send a message',
    body: 'Ask anything — a question, a task, a file to analyze. Artemis receives it through an encrypted connection.',
  },
  {
    step: '02',
    title: 'Artemis reasons with your context',
    body: 'The model searches your Chronicle, retrieves relevant knowledge, runs tools, and builds the answer — all on Cutline infrastructure.',
  },
  {
    step: '03',
    title: 'You get a verified answer',
    body: 'The response streams back with sources cited and memory updated. Every session builds on the last.',
  },
]

const DIFFERENTIATORS = [
  {
    title: 'Own model, from scratch',
    body: 'Artemis is trained by Cutline Industries, not a wrapper around ChatGPT, Claude, or any external API. Blueprint Decision 5.',
  },
  {
    title: 'Your data stays yours',
    body: 'Conversations and knowledge index live on Cutline infrastructure. Nothing is sent to a third-party AI provider.',
  },
  {
    title: 'Memory that compounds',
    body: 'Chronicler captures decisions, preferences, and research. Every session starts with context — not a blank slate.',
  },
  {
    title: 'Tools built in',
    body: 'Web search, document ingestion, and code execution run natively. No plugins, no marketplace — just capability.',
  },
]

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
        <path d="M5 19c6-12 14-12 14-12" />
        <path d="M5 19l14-8" />
        <path d="M15 7l4 4" />
        <circle cx="5" cy="19" r="1.2" fill="currentColor" />
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
          <Link className="artemis-cta-secondary" to="/signin">
            Sign In <Arrow />
          </Link>
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

      <section className="artemis-how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <div className="artemis-steps">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="artemis-step">
              <span className="artemis-step-num" aria-hidden="true">{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="artemis-differentiators" aria-labelledby="diff-heading">
        <h2 id="diff-heading">Built different</h2>
        <div className="artemis-diff-grid">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.title} className="artemis-diff-card">
              <strong>{d.title}</strong>
              <p>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="artemis-cta-section">
        <p className="artemis-tagline">{ARTEMIS_COPY.footer}</p>
        <div className="artemis-hero-actions">
          <Link className="artemis-cta-primary artemis-cta-blue" to="/console?view=chat">
            Open the Console <Arrow />
          </Link>
          <Link className="artemis-cta-secondary" to="/signup">
            Create Account <Arrow />
          </Link>
        </div>
      </section>
    </div>
  )
}
