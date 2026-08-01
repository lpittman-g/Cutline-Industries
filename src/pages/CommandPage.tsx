import { Link } from 'react-router-dom'
import { useCutline } from '../context/CutlineContext'
import { DEMO_LEADS, DEAL_PACKAGES, MONEY_RAILS, PLATFORM_MODULES } from '../data/mega'

export function CommandPage() {
  const { projectClips, projectPacks, activeProject } = useCutline()
  const ready = projectClips.filter((c) => c.status === 'ready' || c.status === 'exported').length
  const hotLeads = DEMO_LEADS.filter((l) => l.stage === 'call' || l.stage === 'replied' || l.stage === 'won')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Command Center</h1>
          <p>
            Cutline Creator OS home — content, growth, and money in one operating picture for{' '}
            {activeProject?.name ?? 'your channel'}.
          </p>
        </div>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/studio">
            Open Studio
          </Link>
          <Link className="btn" to="/autopilot">
            Autopilot
          </Link>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Clips ready</div>
          <div className="value lime">{ready}</div>
        </div>
        <div className="panel stat">
          <div className="label">Short packs</div>
          <div className="value cyan">{projectPacks.length}</div>
        </div>
        <div className="panel stat">
          <div className="label">Hot leads</div>
          <div className="value">{hotLeads.length}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Today&apos;s machine</h3>
          <ul style={{ color: 'var(--muted)', margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7 }}>
            <li>Cut or Autopilot 8–15 Shorts from latest VOD</li>
            <li>Ship 1 value-first outreach wave (10 leads)</li>
            <li>Check Money Stack rails still enabled</li>
            <li>Move any replied lead into Deal Desk</li>
          </ul>
        </section>
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Revenue rails online</h3>
          <div className="hashtag-row">
            {MONEY_RAILS.slice(0, 8).map((r) => (
              <span className="chip ready" key={r.id}>
                {r.name}
              </span>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: '0.85rem' }}>
            <Link className="btn" to="/monetize">
              Full money map
            </Link>
            <Link className="btn" to="/deals">
              Deal packages
            </Link>
          </div>
        </section>
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)' }}>Platform modules</h2>
      <div className="project-grid">
        {PLATFORM_MODULES.map((m) => (
          <Link key={m.id} to={m.path} className="panel project-card" style={{ textDecoration: 'none' }}>
            <div className="chip ready" style={{ marginBottom: '0.45rem' }}>
              {m.status} · {m.group}
            </div>
            <h3>{m.name}</h3>
            <p>{m.blurb}</p>
          </Link>
        ))}
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Featured packages</h3>
        <div className="grid-3">
          {DEAL_PACKAGES.map((p) => (
            <div key={p.id}>
              <h4 style={{ margin: '0 0 0.35rem', color: 'var(--lime)' }}>
                {p.name} · {p.price}
              </h4>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
                {p.includes.join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
