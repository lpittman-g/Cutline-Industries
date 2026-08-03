import { useEffect, useState } from 'react'
import {
  fetchInvestorMetrics,
  fetchRevenueTimeline,
  formatUsd,
  type InvestorMetricsResponse,
  type RevenueTimelinePoint,
} from '../../lib/thermalApi'

export function InvestorsPage() {
  const [data, setData] = useState<InvestorMetricsResponse | null>(null)
  const [timeline, setTimeline] = useState<RevenueTimelinePoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [metrics, revenue] = await Promise.all([
          fetchInvestorMetrics(),
          fetchRevenueTimeline(30),
        ])
        setData(metrics)
        setTimeline(revenue.timeline)
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

      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Revenue trend (30d)</h2>
      <div className="panel" style={{ padding: '1rem' }}>
        <RevenueTrend timeline={timeline} />
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

function RevenueTrend({ timeline }: { timeline: RevenueTimelinePoint[] }) {
  const dailyMap = new Map<string, number>()
  for (const p of timeline) dailyMap.set(p.date, (dailyMap.get(p.date) ?? 0) + p.amountCents)
  const days = [...dailyMap.entries()].map(([date, cents]) => ({ date, cents }))

  if (days.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', margin: 0 }}>
        No completed sales in the last 30 days yet.
      </p>
    )
  }

  let run = 0
  const points = days.map((d) => {
    run += d.cents
    return { ...d, cumulative: run }
  })

  const W = 720
  const H = 200
  const padX = 44
  const padY = 20
  const chartW = W - padX * 2
  const chartH = H - padY * 2
  const maxDaily = Math.max(...points.map((p) => p.cents), 1)
  const maxCum = Math.max(run, 1)
  const slot = chartW / points.length
  const barW = Math.max(4, Math.min(28, slot * 0.6))

  const x = (i: number) => padX + slot * i + slot / 2
  const yBar = (cents: number) => padY + chartH - (cents / maxDaily) * chartH
  const yLine = (cum: number) => padY + chartH - (cum / maxCum) * chartH

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yLine(p.cumulative).toFixed(1)}`)
    .join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Revenue trend chart">
        <line
          x1={padX}
          y1={padY + chartH}
          x2={W - padX}
          y2={padY + chartH}
          stroke="var(--muted)"
          strokeOpacity="0.3"
        />
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - barW / 2}
            y={yBar(p.cents)}
            width={barW}
            height={padY + chartH - yBar(p.cents)}
            fill="var(--cyan)"
            fillOpacity="0.55"
            rx="2"
          />
        ))}
        <path d={linePath} fill="none" stroke="var(--lime)" strokeWidth="2.5" />
        {points.map((p, i) => (
          <circle key={`c-${p.date}`} cx={x(i)} cy={yLine(p.cumulative)} r="2.5" fill="var(--lime)" />
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--muted)',
          fontSize: '0.8rem',
          marginTop: '0.25rem',
        }}
      >
        <span>{points[0].date}</span>
        <span>
          <span style={{ color: 'var(--cyan)' }}>daily</span> ·{' '}
          <span style={{ color: 'var(--lime)' }}>cumulative {formatUsd(run)}</span>
        </span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  )
}
