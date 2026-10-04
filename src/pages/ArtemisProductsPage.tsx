import { Link } from 'react-router-dom'
import { ArtemisMark } from '../components/artemis/ArtemisMark'

const PRODUCTS = [
  {
    id: 'chat',
    name: 'Artemis Chat',
    tagline: 'The full conversation experience',
    description:
      'Private, persistent conversations with the Artemis model. Saved history, voice mode, file uploads, and a full workspace — all on Cutline infrastructure with no outside AI in the loop.',
    cta: 'Open Chat',
    href: '/artemisChat',
    available: true,
  },
  {
    id: 'workspace',
    name: 'Artemis Workspace',
    tagline: 'Included with Chat',
    description:
      'The views inside Chat — conversation history, code output, and tool activity. Memory board (Chronicle), file knowledge index (Quiver), and branched message editing are part of the workspace.',
    cta: 'Open Workspace',
    href: '/artemisChat',
    available: true,
  },
  {
    id: 'api',
    name: 'Artemis API',
    tagline: 'Developer access',
    description:
      'Bring Artemis into your own applications. Stream completions, manage memory, and run tools through the same backend that powers Chat — verified, private, no third-party model.',
    cta: 'Contact for Access',
    href: 'mailto:hello@cutline-industries.studio',
    available: false,
  },
]

function Arrow() {
  return <span className="artemis-cta-arrow" aria-hidden="true">→</span>
}

export function ArtemisProductsPage() {
  return (
    <div className="artemis-landing">
      <section className="artemis-hero" style={{ paddingBottom: '2rem' }}>
        <ArtemisMark size={56} />
        <h1>Products</h1>
        <p className="artemis-kicker">What Artemis offers</p>
        <p className="artemis-lede">
          Three surfaces. One model. Every product runs on the same trained Artemis checkpoint — no
          outside AI substituted.
        </p>
      </section>

      <section className="artemis-how-it-works" aria-labelledby="products-heading">
        <h2 id="products-heading" className="visually-hidden">Product list</h2>
        <div className="artemis-products-list">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="artemis-product-card">
              <header className="artemis-product-card-header">
                <strong className="artemis-product-card-name">{p.name}</strong>
                <span className="artemis-product-card-tag">{p.tagline}</span>
              </header>
              <p className="artemis-product-card-body">{p.description}</p>
              {p.available ? (
                <Link className="artemis-cta-primary artemis-cta-blue artemis-cta-compact" to={p.href}>
                  {p.cta} <Arrow />
                </Link>
              ) : (
                <a className="artemis-cta-secondary artemis-cta-compact" href={p.href}>
                  {p.cta} <Arrow />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="artemis-cta-section">
        <p className="artemis-tagline">Start with a free conversation</p>
        <div className="artemis-hero-actions">
          <Link className="artemis-cta-primary artemis-cta-blue" to="/artemisChat">
            Open Artemis Chat <Arrow />
          </Link>
          <Link className="artemis-cta-secondary" to="/signup">
            Create Account <Arrow />
          </Link>
        </div>
      </section>
    </div>
  )
}
