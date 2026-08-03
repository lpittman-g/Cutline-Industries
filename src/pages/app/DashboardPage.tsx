import { useEffect, useState } from 'react'
import { fetchDashboardSummary, type DashboardSummary } from '../../lib/thermalApi'

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setSummary(await fetchDashboardSummary())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Dashboard unavailable')
      }
    }
    load()
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [])

  const heat = summary?.heatAlert

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Mission Control — heat alerts, revenue, and clip throughput.</p>
        </div>
        {heat && (
          <div className="chip warn heat-toast">
            HEAT DETECTED · {heat.msgPerMin} msg/min on {heat.streamer}
          </div>
        )}
      </div>

      {error && <p className="chip warn">{error}</p>}

      <div className="grid-3">
        <div className="panel stat">
          <div className="label">Total revenue</div>
          <div className="value lime">
            ${((summary?.totalRevenueCents ?? 0) / 100).toFixed(0)}
          </div>
        </div>
        <div className="panel stat">
          <div className="label">Active live channels</div>
          <div className="value cyan">{summary?.activeLiveChannels ?? '—'}</div>
        </div>
        <div className="panel stat">
          <div className="label">Daily clips rendered</div>
          <div className="value">{summary?.dailyClipsRendered ?? '—'}</div>
        </div>
      </div>
      <div className="panel stat" style={{ marginTop: '1rem', maxWidth: 320 }}>
        <div className="label">Pending outreaches</div>
        <div className="value">{summary?.pendingOutreaches ?? '—'}</div>
      </div>
    </div>
  )
}
