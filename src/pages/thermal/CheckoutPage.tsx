import { Link, useParams } from 'react-router-dom'
import { DEMO_BOUNTY_CLIPS } from '../../data/thermal'

export function CheckoutPage() {
  const { clipId } = useParams()
  const clip = DEMO_BOUNTY_CLIPS.find((c) => c.id === clipId)

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Checkout</h1>
          <p>Stripe Hosted Gateway (Apple Pay & card) — fulfillment delivers clean assets after pay.</p>
        </div>
      </div>

      <section className="panel panel-pad">
        {clip ? (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>{clip.title}</h2>
            <p style={{ color: 'var(--muted)' }}>
              @{clip.streamer} · {clip.game} · {clip.priceLabel}
            </p>
            <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              <li>Unwatermarked 4K MP4</li>
              <li>Transcript text file</li>
              <li>Pre-written social captions</li>
            </ul>
            <p className="chip warn">Stripe checkout link — wire live price ID next</p>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary" disabled>
                Pay with Stripe
              </button>
              <Link className="btn" to="/bounty">
                Back to Bounty Board
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--muted)' }}>Clip not found.</p>
            <Link className="btn" to="/bounty">
              Browse bounty board
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
