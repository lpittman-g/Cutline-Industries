import { Link } from 'react-router-dom'

const DASHES = [
  { top: '12%', delay: '0s',   dur: '5.2s' },
  { top: '24%', delay: '1.1s', dur: '4.8s' },
  { top: '38%', delay: '0.4s', dur: '6.1s' },
  { top: '52%', delay: '2.3s', dur: '5.6s' },
  { top: '65%', delay: '0.8s', dur: '4.4s' },
  { top: '78%', delay: '1.7s', dur: '5.9s' },
  { top: '88%', delay: '3.1s', dur: '4.6s' },
  { top: '18%', delay: '2.8s', dur: '6.3s' },
  { top: '44%', delay: '0.2s', dur: '5.0s' },
  { top: '70%', delay: '1.5s', dur: '4.9s' },
  { top: '30%', delay: '3.6s', dur: '5.7s' },
  { top: '56%', delay: '0.9s', dur: '6.0s' },
]

function MeshDiagram() {
  return (
    <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* center Mesh circle */}
      <circle cx="130" cy="90" r="28" fill="#0a0b0e" stroke="rgba(77,142,248,0.45)" strokeWidth="1.5" />
      <text x="130" y="94" textAnchor="middle" fill="#4d8ef8" fontSize="10" fontWeight="600">Mesh</text>
      {/* nodes */}
      {[
        { x: 40,  y: 38,  label: 'A' },
        { x: 220, y: 38,  label: 'B' },
        { x: 40,  y: 142, label: 'C' },
        { x: 220, y: 142, label: 'D' },
      ].map(({ x, y, label }) => (
        <g key={label}>
          <line x1={x} y1={y} x2="130" y2="90" stroke="rgba(77,142,248,0.25)" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx={x} cy={y} r="16" fill="#0a0b0e" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          <text x={x} y={y + 4} textAnchor="middle" fill="rgba(237,238,242,0.7)" fontSize="9" fontWeight="600">{label}</text>
        </g>
      ))}
    </svg>
  )
}

function BowTable() {
  const rows = [
    { tenant: 'Tenant 01', agent: 'Artemis', run: 'idle' as const },
    { tenant: 'Tenant 02', agent: 'Voice',   run: 'inrun' as const },
    { tenant: 'Tenant 03', agent: 'Apollo',  run: 'auth' as const },
    { tenant: 'Tenant 04', agent: 'Artemis', run: 'routed' as const },
  ]
  const label = { idle: 'Idle', inrun: 'In run', auth: 'Authorized', routed: 'Routed' }
  return (
    <table className="al-bow-table">
      <thead>
        <tr>
          <th>Tenant</th>
          <th>Agent</th>
          <th>Run</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tenant}>
            <td>{r.tenant}</td>
            <td>{r.agent}</td>
            <td><span className={`al-run-pill al-run-${r.run}`}>{label[r.run]}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function VoiceChart() {
  const bars = [
    { label: 'Vapi',   h: 72 },
    { label: 'Bland',  h: 52 },
    { label: 'Retell', h: 88 },
  ]
  return (
    <div className="al-voice-chart">
      {bars.map((b) => (
        <div key={b.label} className="al-voice-bar-col">
          <div className="al-voice-bar" style={{ height: b.h }} />
          <span>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function EngineCard() {
  return (
    <div className="al-engine-section">
      <div className="al-engine-row">
        <span className="al-engine-label">System Prompt</span>
        <span className="al-engine-meta" style={{ color: 'var(--ag-body)', fontSize: '0.72rem' }}>
          You are Artemis, an intelligent agent…
        </span>
      </div>
      <div className="al-engine-row">
        <span className="al-engine-label">Skills</span>
        <div className="al-engine-chips">
          <span className="al-engine-chip">lookup</span>
          <span className="al-engine-chip">draft</span>
          <span className="al-engine-chip">handoff</span>
        </div>
      </div>
      <div className="al-engine-row">
        <span className="al-engine-label">Memory</span>
        <span className="al-engine-meta">Tenant scope · open loops · last run</span>
      </div>
    </div>
  )
}

export function ArtemisLandingPage() {
  const scrollToProducts = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="artemis-landing">
      {/* ── Hero ─────────────────────────────────── */}
      <section className="al-hero">
        <div className="al-hero-dashes" aria-hidden="true">
          {DASHES.map((d, i) => (
            <span
              key={i}
              className="al-dash"
              style={{ '--top': d.top, '--delay': d.delay, '--d': d.dur } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="al-hero-inner">
          <span className="al-kicker">Agent and Model Platform</span>
          <h1>Artemis AI</h1>
          <p>
            Agents, models, and memory — wired together. Apollo routes calls, The Bow
            runs hunts, Voice handles lines. One engine behind every seat.
          </p>
          <div className="al-hero-actions">
            <Link to="/artemisChat" className="al-cta-dark">Get started</Link>
            <button type="button" className="al-cta-outline" onClick={scrollToProducts}>
              View products
            </button>
          </div>
        </div>
      </section>

      {/* ── Built for the seat ───────────────────── */}
      <section className="al-seat">
        <h2>Built for the seat you are in.</h2>
      </section>

      {/* ── Products ─────────────────────────────── */}
      <div id="products" className="al-products">

        {/* Apollo / Mesh */}
        <div className="al-product">
          <div>
            <span className="al-product-label">Apollo</span>
            <h3>Mesh routing</h3>
            <p>
              Providers A–D plug into a central Mesh. Apollo scores each route in real
              time and sends calls down the best path — cost, latency, and compliance
              weighted together.
            </p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title">
                <span className="al-demo-dot" />
                Apollo
                <span className="al-demo-badge">Mesh</span>
              </div>
              <div className="al-mesh"><MeshDiagram /></div>
              <p className="al-demo-caption">Providers A–D are routes, not customers.</p>
            </div>
          </div>
        </div>

        {/* Console / The Bow */}
        <div className="al-product al-flip">
          <div>
            <span className="al-product-label">Console</span>
            <h3>The Bow</h3>
            <p>
              One table — every tenant, agent, and active run. Dispatch new hunts,
              monitor live status, and hand off to the right agent without switching tabs.
            </p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title">
                <span className="al-demo-dot" />
                The Bow
                <span className="al-demo-badge">Console</span>
              </div>
              <BowTable />
            </div>
          </div>
        </div>

        {/* Telephony / Voice */}
        <div className="al-product">
          <div>
            <span className="al-product-label">Telephony</span>
            <h3>Voice</h3>
            <p>
              Vapi, Bland, and Retell — all live at once. Only lines the operator is
              authorized to use appear. Routing logic lives in Apollo, not in each
              provider's dashboard.
            </p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title">
                <span className="al-demo-dot" />
                Voice
                <span className="al-demo-badge">Telephony</span>
              </div>
              <VoiceChart />
              <p className="al-demo-caption">Only lines the operator is authorized to use.</p>
            </div>
          </div>
        </div>

        {/* Engine / Artemis */}
        <div className="al-product al-flip">
          <div>
            <span className="al-product-label">Engine</span>
            <h3>Artemis</h3>
            <p>
              System prompt, skills, and memory — defined once per tenant. Every agent
              session inherits them. Change a skill globally or scope it to one seat.
            </p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title">
                <span className="al-demo-dot" />
                Artemis
                <span className="al-demo-badge">Engine</span>
              </div>
              <EngineCard />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
