import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  confirmCheckoutSession,
  createCheckoutSession,
  fetchClip,
  fetchClipDownload,
  formatUsd,
  tierPriceLabel,
  type ThermalClip,
} from '../../lib/thermalApi'

export function CheckoutPage() {
  const { clipId } = useParams()
  const [search] = useSearchParams()
  const numericId = Number(clipId)
  const [clip, setClip] = useState<ThermalClip | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const paid = search.get('paid') === '1'
  const canceled = search.get('canceled') === '1'
  const requestedTier = search.get('tier')
  const checkoutTier = requestedTier === 'bounty' ? 'bounty' : clip?.tier ?? 'gateway'

  useEffect(() => {
    if (!numericId) return
    fetchClip(numericId)
      .then((data) => {
        setClip(data.clip)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Clip unavailable'))
  }, [numericId])

  useEffect(() => {
    const sessionId = search.get('session_id')
    if (!sessionId || !paid) return
    confirmCheckoutSession(sessionId)
      .then((result) => {
        if (result.ok && numericId) {
          return Promise.all([
            fetchClip(numericId).then((data) => setClip(data.clip)),
            fetchClipDownload(numericId, sessionId).then((data) => setDownloadUrl(data.url)),
          ])
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not confirm payment'))
  }, [search, paid, numericId])

  const startCheckout = async () => {
    if (!clip) return
    setLoading(true)
    setError(null)
    try {
      const session = await createCheckoutSession(clip.id, checkoutTier)
      window.location.href = session.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setLoading(false)
    }
  }

  const amountCents = checkoutTier === 'bounty' ? 5000 : 1500

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Checkout</h1>
          <p>Stripe Hosted Gateway (Apple Pay & card) — fulfillment delivers clean assets after pay.</p>
        </div>
      </div>

      <section className="panel panel-pad">
        {error && <p className="chip warn">{error}</p>}
        {canceled && !paid && <p className="chip warn">Checkout canceled — try again when ready.</p>}
        {paid && clip?.status === 'claimed' && (
          <p className="chip ok">Payment complete — clean assets unlocked.</p>
        )}

        {clip ? (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
              {clip.title ?? `Clip #${clip.id}`}
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              @{clip.streamer_username} · {clip.game} · {tierPriceLabel(checkoutTier)} (
              {formatUsd(amountCents)})
            </p>
            <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              <li>Unwatermarked vertical MP4</li>
              <li>Private download after verified payment</li>
              <li>15-minute secure S3 link when cloud storage is enabled</li>
            </ul>
            {clip.status === 'claimed' ? (
              <p className="chip ok">Already claimed</p>
            ) : (
              <p className="chip">Stripe Checkout — live when STRIPE_SECRET_KEY is set</p>
            )}
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              {downloadUrl && (
                <a className="btn btn-primary" href={downloadUrl}>
                  Download clean clip
                </a>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || clip.status === 'claimed'}
                onClick={() => void startCheckout()}
              >
                {loading ? 'Redirecting…' : 'Pay with Stripe'}
              </button>
              <Link className="btn" to="/bounty">
                Back to Bounty Board
              </Link>
            </div>
          </>
        ) : !error ? (
          <p style={{ color: 'var(--muted)' }}>Loading clip…</p>
        ) : (
          <>
            <p style={{ color: 'var(--muted)' }}>Clip not found or database unavailable.</p>
            <Link className="btn" to="/bounty">
              Browse bounty board
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
