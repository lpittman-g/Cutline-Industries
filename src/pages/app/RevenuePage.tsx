import { useEffect, useState } from 'react'
import {
  fetchRevenueTimeline,
  fetchSales,
  formatUsd,
  type ThermalSale,
} from '../../lib/thermalApi'

export function RevenuePage() {
  const [byTier, setByTier] = useState({ gateway: 0, bounty: 0, retainer: 0 })
  const [sales, setSales] = useState<ThermalSale[]>([])
  const [stripeMode, setStripeMode] = useState<string>('unknown')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [timeline, ledger] = await Promise.all([fetchRevenueTimeline(), fetchSales()])
        setByTier({
          gateway: timeline.byTier.gateway ?? 0,
          bounty: timeline.byTier.bounty ?? 0,
          retainer: timeline.byTier.retainer ?? 0,
        })
        setSales(ledger.sales)
        setStripeMode(ledger.stripeMode ?? 'unknown')
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Revenue data unavailable')
      }
    }
    load()
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Revenue</h1>
          <p>Three-tier breakdown + Stripe sync ledger.</p>
        </div>
        <p className="chip">Stripe: {stripeMode}</p>
      </div>

      {error && <p className="chip warn">{error}</p>}

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Gateway $15</div>
          <div className="value lime">{formatUsd(byTier.gateway)}</div>
        </div>
        <div className="panel stat">
          <div className="label">Bounty $50</div>
          <div className="value cyan">{formatUsd(byTier.bounty)}</div>
        </div>
        <div className="panel stat">
          <div className="label">Retainer $750+</div>
          <div className="value">{formatUsd(byTier.retainer)}</div>
        </div>
      </div>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Payouts & Stripe sync</h3>
        {sales.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No completed sales yet — claim a clip via Stripe Checkout on the Bounty Board.
          </p>
        ) : (
          <ul style={{ color: 'var(--muted)', lineHeight: 1.8, margin: 0, paddingLeft: '1.1rem' }}>
            {sales.map((sale) => (
              <li key={sale.id}>
                {sale.status === 'completed' ? 'Completed' : sale.status} ·{' '}
                {formatUsd(sale.amount_cents)} · {sale.tier}
                {sale.clip_id ? ` · clip #${sale.clip_id}` : ''}
                {sale.buyer_email ? ` · ${sale.buyer_email}` : ''}
                {sale.status === 'completed' ? ' · synced' : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
