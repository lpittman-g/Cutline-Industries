import { useMemo, useState } from 'react'
import { AdSlot } from '../components/AdSlot'
import { ADSENSE_PAGE_SLOTS, MONEY_NOW_ACTIONS, type MoneyActionStatus } from '../data/moneyNow'

const STATUS_ORDER: MoneyActionStatus[] = ['todo', 'doing', 'done', 'blocked']

export function MoneyNowPage() {
  const [actions, setActions] = useState(MONEY_NOW_ACTIONS)

  const counts = useMemo(() => {
    return STATUS_ORDER.reduce(
      (acc, s) => {
        acc[s] = actions.filter((a) => a.status === s).length
        return acc
      },
      {} as Record<MoneyActionStatus, number>,
    )
  }, [actions])

  function cycleStatus(id: string) {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const idx = STATUS_ORDER.indexOf(a.status)
        return { ...a, status: STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] }
      }),
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Money Now</h1>
          <p>
            Use Google AdSense, YouTube, AWS, Replit, GPT, and Stripe as leverage — not competitors.
            Execute these actions to turn Cutline into cashflow.
          </p>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Todo</div>
          <div className="value">{counts.todo}</div>
        </div>
        <div className="panel stat">
          <div className="label">Doing</div>
          <div className="value cyan">{counts.doing}</div>
        </div>
        <div className="panel stat">
          <div className="label">Done</div>
          <div className="value lime">{counts.done}</div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <AdSlot />
      </div>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Stack roles</h3>
        <div className="grid-3">
          <div className="card-lite">
            <h4>Google AdSense</h4>
            <p>Display revenue on cutline-industries.studio while YouTube grows.</p>
          </div>
          <div className="card-lite">
            <h4>YouTube + Autopilot</h4>
            <p>Shorts volume → YPP ads, Premium, memberships, Shopping.</p>
          </div>
          <div className="card-lite">
            <h4>AWS Amplify / EC2</h4>
            <p>Always-on site + Autopilot worker for cutting/uploading.</p>
          </div>
          <div className="card-lite">
            <h4>Replit</h4>
            <p>Fast sponsor forms, bots, experiments without slowing core OS.</p>
          </div>
          <div className="card-lite">
            <h4>GPT</h4>
            <p>Copy factory for ads, outreach, titles, and sponsor one-pagers.</p>
          </div>
          <div className="card-lite">
            <h4>Stripe</h4>
            <p>Cash now via Spark Pack / retainers before YPP matures.</p>
          </div>
        </div>
      </section>

      <div className="project-grid">
        {actions.map((action) => (
          <article key={action.id} className="panel pack-card">
            <div className="hashtag-row" style={{ marginBottom: '0.45rem' }}>
              <span className="chip ready">{action.platform}</span>
              <span className={`chip ${action.impact === 'high' ? 'ready' : 'draft'}`}>
                {action.impact} impact
              </span>
              <span className="chip draft">{action.eta}</span>
            </div>
            <h3 style={{ marginTop: 0 }}>{action.title}</h3>
            <ul style={{ color: 'var(--muted)', paddingLeft: '1.1rem' }}>
              {action.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <button className="btn btn-primary" type="button" onClick={() => cycleStatus(action.id)}>
              Status: {action.status}
            </button>
          </article>
        ))}
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>AdSense slot map</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Placement</th>
            </tr>
          </thead>
          <tbody>
            {ADSENSE_PAGE_SLOTS.map((slot) => (
              <tr key={slot.id}>
                <td>{slot.page}</td>
                <td>{slot.placement}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: 'var(--muted)', marginTop: '0.75rem' }}>
          After AdSense gives you publisher ID + ad unit codes, paste them into site env vars and
          redeploy Amplify. Keep content useful — thin pages get limited/denied.
        </p>
      </section>
    </div>
  )
}
