import { useCutline } from '../context/cutlineContextObject'
import { DEMO_LEADS } from '../data/mega'

export function AnalyticsPage() {
  const { projectClips, projectPacks } = useCutline()
  const avgScore = projectClips.length
    ? Math.round(projectClips.reduce((a, c) => a + c.score, 0) / projectClips.length)
    : 0
  const replied = DEMO_LEADS.filter((l) => ['replied', 'call', 'won'].includes(l.stage)).length
  const replyRate = Math.round((replied / DEMO_LEADS.length) * 100)

  const metrics = [
    { label: 'Avg clip score', value: String(avgScore), tone: 'lime' as const },
    { label: 'Packs queued', value: String(projectPacks.length), tone: 'cyan' as const },
    { label: 'Outreach reply rate', value: `${replyRate}%`, tone: 'lime' as const },
    { label: 'Est. Shorts / week', value: String(Math.max(projectClips.length, 12)), tone: 'cyan' as const },
    { label: 'YPP rails tracked', value: '9', tone: 'lime' as const },
    { label: 'Open deal value', value: '$8.2k', tone: 'cyan' as const },
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pulse Analytics</h1>
          <p>
            Content quality, outreach velocity, and money signals in one pulse for Cutline
            Industries.
          </p>
        </div>
      </div>

      <div className="grid-3">
        {metrics.map((m) => (
          <div className="panel stat" key={m.label}>
            <div className="label">{m.label}</div>
            <div className={`value ${m.tone}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Operating targets</h3>
        <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          <li>Shorts posted daily via Autopilot</li>
          <li>Avg clip score ≥ 75 before publish</li>
          <li>Outreach reply rate ≥ 15%</li>
          <li>At least 1 deal conversation booked per week</li>
          <li>Review RPM + top traffic sources every Monday</li>
        </ul>
      </section>
    </div>
  )
}
