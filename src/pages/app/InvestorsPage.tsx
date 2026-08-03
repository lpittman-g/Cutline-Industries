import { useEffect, useState } from 'react'
import { fetchInvestorMetrics, formatUsd, type InvestorMetricsResponse } from '../../lib/thermalApi'

export function InvestorsPage() {
  const [data, setData] = useState<InvestorMetricsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setData(await fetchInvestorMetrics())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Metrics unavailable')
      }
    }
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [])

  const m = data?.metrics
  const arrCents = (m?.mrrCents ?? 0) * 12
  const conversion =
    m && m.clipsTotal > 0 ? Math.round((m.clipsSold / m.clipsTotal) * 100) : 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Investor Snapshot</h1>
          <p>Live traction across the Thermal funnel — heat, clips, revenue, and recurring.</p>
        </div>
        {data && (
          <div className="chip">
            Stripe: {data.stripeMode ?? 'unset'} · updated{' '}
            {new Date(data.generatedAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && <p className="chip warn">{error}</p>}

      <div className="grid-3">
        <div className="panel stat">
          <div className="label">Total revenue</div>
          <div className="value lime">{formatUsd(m?.totalRevenueCents ?? 0)}</div>
        </div>
        <div className="panel stat">
          <div className="label">MRR (active retainers)</div>
          <div className="value cyan">{formatUsd(m?.mrrCents ?? 0)}</div>
        </div>
        <div className="panel stat">
          <div className="label">Annual run-rate (ARR)</div>
          <div className="value lime">{formatUsd(arrCents)}</div>
        </div>
      </div>

      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Funnel</h2>
      <div className="grid-3">
        <div className="panel stat">
          <div className="label">Streamers monitored</div>
          <div className="value cyan">{m?.streamersTotal ?? '—'}</div>
          <div className="label">{m?.streamersLive ?? 0} live now</div>
        </div>
        <div className="panel stat">
          <div className="label">Heat spikes detected</div>
          <div className="value">{m?.heatSpikesTotal ?? '—'}</div>
        </div>
        <div className="panel stat">
          <div className="label">Clips produced</div>
          <div className="value">{m?.clipsTotal ?? '—'}</div>
          <div className="label">{m?.clipsSold ?? 0} sold</div>
        </div>
        <div className="panel stat">
          <div className="label">Clip → sale conversion</div>
          <div className="value lime">{conversion}%</div>
        </div>
        <div className="panel stat">
          <div className="label">Completed sales</div>
          <div className="value">{m?.salesCompleted ?? '—'}</div>
        </div>
        <div className="panel stat">
          <div className="label">Active retainers</div>
          <div className="value cyan">{m?.activeRetainers ?? '—'}</div>
        </div>
      </div>

      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Revenue by tier</h2>
      <div className="grid-3">
        <div className="panel stat">
          <div className="label">Gateway ($15 clips)</div>
          <div className="value lime">{formatUsd(m?.revenueByTier.gateway ?? 0)}</div>
        </div>
        <div className="panel stat">
          <div className="label">Bounty ($50 clips)</div>
          <div className="value lime">{formatUsd(m?.revenueByTier.bounty ?? 0)}</div>
        </div>
        <div className="panel stat">
          <div className="label">Retainer ($750+/mo)</div>
          <div className="value lime">{formatUsd(m?.revenueByTier.retainer ?? 0)}</div>
        </div>
      </div>

      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Distribution reach</h2>
      <div className="grid-3">
        <div className="panel stat">
          <div className="label">Bounty posts</div>
          <div className="value">{m?.bountyPosts ?? '—'}</div>
        </div>
        <div className="panel stat">
          <div className="label">Total views</div>
          <div className="value cyan">
            {(m?.bountyViews ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="panel stat">
          <div className="label">Total engagement</div>
          <div className="value">{(m?.bountyEngagement ?? 0).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}
