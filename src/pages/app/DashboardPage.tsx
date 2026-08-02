import { DEMO_APP_KPIS } from '../../data/thermal'

export function DashboardPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Mission Control — heat alerts, revenue, and clip throughput.</p>
        </div>
        <div className="chip warn heat-toast">HEAT DETECTED · 186 msg/min on nova_fps</div>
      </div>

      <div className="grid-3">
        <div className="panel stat">
          <div className="label">Total revenue</div>
          <div className="value lime">{DEMO_APP_KPIS.totalRevenue}</div>
        </div>
        <div className="panel stat">
          <div className="label">Active live channels</div>
          <div className="value cyan">{DEMO_APP_KPIS.activeLiveChannels}</div>
        </div>
        <div className="panel stat">
          <div className="label">Daily clips rendered</div>
          <div className="value">{DEMO_APP_KPIS.dailyClipsRendered}</div>
        </div>
      </div>
      <div className="panel stat" style={{ marginTop: '1rem', maxWidth: 320 }}>
        <div className="label">Pending outreaches</div>
        <div className="value">{DEMO_APP_KPIS.pendingOutreaches}</div>
      </div>
    </div>
  )
}
