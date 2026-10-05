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

const SERVICES = [
  {
    icon: '✦',
    name: 'Agent Platform',
    desc: 'Deploy intelligent agents that hold context across sessions, use tools, and hand off to humans when it matters.',
  },
  {
    icon: '◎',
    name: 'Voice Infrastructure',
    desc: 'One API into Vapi, Bland, and Retell. Your operators see only the lines they're authorized to use.',
  },
  {
    icon: '◈',
    name: 'Apollo Routing',
    desc: 'Real-time call routing scored on cost, latency, and compliance. Switch providers without rewriting your stack.',
  },
  {
    icon: '⋔',
    name: 'Memory & Knowledge',
    desc: 'Tenant-scoped memory that persists across sessions. Artemis remembers what matters and forgets what doesn't.',
  },
  {
    icon: '⌥',
    name: 'Developer API',
    desc: 'REST and streaming endpoints for every surface. Build agents, query memory, and stream responses in minutes.',
  },
  {
    icon: '◉',
    name: 'Operator Console',
    desc: 'The Bow puts every tenant, agent, and active run in one table. Dispatch, monitor, and hand off without switching tabs.',
  },
]

const AUDIENCES = [
  {
    tag: 'For Operators',
    headline: 'Run every seat from one console.',
    body: 'Multi-tenant deployments, live run status, and agent dispatch — all in The Bow. No dashboards to juggle, no scripts to maintain per provider.',
    cta: 'Open The Bow',
    href: '/artemisChat',
  },
  {
    tag: 'For Developers',
    headline: 'Ship agents, not boilerplate.',
    body: 'REST + streaming API, a skills library, and memory built in. Bring your own model or use the Artemis engine. First agent in under an hour.',
    cta: 'Read the docs',
    href: '/artemisChat',
  },
  {
    tag: 'For Enterprise',
    headline: 'Isolated, auditable, and on your terms.',
    body: 'Tenant-level data isolation, SOC 2 posture, and white-glove onboarding. SLA-backed infrastructure that runs where you need it.',
    cta: 'Talk to us',
    href: '/artemisChat',
  },
]

const TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    sub: 'No credit card required',
    features: [
      '1 agent deployment',
      'The Bow console',
      'Artemis engine access',
      '1,000 messages / mo',
      'Community support',
    ],
    cta: 'Start building',
    href: '/artemisChat',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$299',
    sub: 'per month',
    features: [
      'Unlimited agent deployments',
      'Apollo Mesh routing',
      'Voice (Vapi · Bland · Retell)',
      'Tenant-scoped memory',
      '50,000 messages / mo',
      'Priority support',
    ],
    cta: 'Get Pro',
    href: '/artemisChat',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    sub: 'volume + SLA',
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'Data isolation per tenant',
      'SOC 2 & compliance docs',
      'Unlimited messages',
      'White-glove onboarding',
    ],
    cta: 'Contact us',
    href: '/artemisChat',
    highlight: false,
  },
]

const STATS = [
  { value: '4',       label: 'Voice providers' },
  { value: '1',       label: 'Unified API' },
  { value: '<50ms',   label: 'Routing latency' },
  { value: '∞',       label: 'Tenant isolation' },
]

function MeshDiagram() {
  return (
    <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="130" cy="90" r="28" fill="#0a0b0e" stroke="rgba(77,142,248,0.45)" strokeWidth="1.5" />
      <text x="130" y="94" textAnchor="middle" fill="#4d8ef8" fontSize="10" fontWeight="600">Mesh</text>
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
    { tenant: 'Tenant 01', agent: 'Artemis', run: 'idle'   as const },
    { tenant: 'Tenant 02', agent: 'Voice',   run: 'inrun'  as const },
    { tenant: 'Tenant 03', agent: 'Apollo',  run: 'auth'   as const },
    { tenant: 'Tenant 04', agent: 'Artemis', run: 'routed' as const },
  ]
  const label = { idle: 'Idle', inrun: 'In run', auth: 'Authorized', routed: 'Routed' }
  return (
    <table className="al-bow-table">
      <thead><tr><th>Tenant</th><th>Agent</th><th>Run</th></tr></thead>
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
  return (
    <div className="al-voice-chart">
      {[{ label: 'Vapi', h: 72 }, { label: 'Bland', h: 52 }, { label: 'Retell', h: 88 }].map((b) => (
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
        <span style={{ color: 'var(--ag-body)', fontSize: '0.72rem' }}>You are Artemis, an intelligent agent…</span>
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
  const scrollToProducts = () =>
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="artemis-landing">

      {/* ── Hero ──────────────────────────────────── */}
      <section className="al-hero">
        <div className="al-hero-dashes" aria-hidden="true">
          {DASHES.map((d, i) => (
            <span key={i} className="al-dash"
              style={{ '--top': d.top, '--delay': d.delay, '--d': d.dur } as React.CSSProperties} />
          ))}
        </div>
        <div className="al-hero-inner">
          <span className="al-kicker">Agent and Model Platform</span>
          <h1>Artemis AI</h1>
          <p>
            Agents, models, and memory — wired together. Apollo routes calls,
            The Bow runs hunts, Voice handles lines. One engine behind every seat.
          </p>
          <div className="al-hero-actions">
            <Link to="/artemisChat" className="al-cta-dark">Get started</Link>
            <button type="button" className="al-cta-outline" onClick={scrollToProducts}>
              View products
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────── */}
      <div className="al-stats">
        {STATS.map((s) => (
          <div key={s.label} className="al-stat">
            <span className="al-stat-value">{s.value}</span>
            <span className="al-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Built for the seat ───────────────────── */}
      <section className="al-seat">
        <h2>Built for the seat you are in.</h2>
        <p>
          Whether you're running a contact center, shipping agents, or managing enterprise
          deployments — Artemis meets you where you work.
        </p>
      </section>

      {/* ── Products ─────────────────────────────── */}
      <div id="products" className="al-products">

        <div className="al-product">
          <div>
            <span className="al-product-label">Apollo</span>
            <h3>Mesh routing</h3>
            <p>Providers A–D plug into a central Mesh. Apollo scores each route in real time and sends calls down the best path — cost, latency, and compliance weighted together.</p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title"><span className="al-demo-dot" />Apollo<span className="al-demo-badge">Mesh</span></div>
              <div className="al-mesh"><MeshDiagram /></div>
              <p className="al-demo-caption">Providers A–D are routes, not customers.</p>
            </div>
          </div>
        </div>

        <div className="al-product al-flip">
          <div>
            <span className="al-product-label">Console</span>
            <h3>The Bow</h3>
            <p>One table — every tenant, agent, and active run. Dispatch new hunts, monitor live status, and hand off to the right agent without switching tabs.</p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title"><span className="al-demo-dot" />The Bow<span className="al-demo-badge">Console</span></div>
              <BowTable />
            </div>
          </div>
        </div>

        <div className="al-product">
          <div>
            <span className="al-product-label">Telephony</span>
            <h3>Voice</h3>
            <p>Vapi, Bland, and Retell — all live at once. Only lines the operator is authorized to use appear. Routing logic lives in Apollo, not in each provider's dashboard.</p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title"><span className="al-demo-dot" />Voice<span className="al-demo-badge">Telephony</span></div>
              <VoiceChart />
              <p className="al-demo-caption">Only lines the operator is authorized to use.</p>
            </div>
          </div>
        </div>

        <div className="al-product al-flip">
          <div>
            <span className="al-product-label">Engine</span>
            <h3>Artemis</h3>
            <p>System prompt, skills, and memory — defined once per tenant. Every agent session inherits them. Change a skill globally or scope it to one seat.</p>
          </div>
          <div>
            <div className="al-demo-card">
              <div className="al-demo-card-title"><span className="al-demo-dot" />Artemis<span className="al-demo-badge">Engine</span></div>
              <EngineCard />
            </div>
          </div>
        </div>

      </div>

      {/* ── Services grid ────────────────────────── */}
      <section className="al-services">
        <div className="al-section-head">
          <span className="al-kicker" style={{ marginBottom: '0.65rem' }}>What we offer</span>
          <h2>Everything your stack needs, nothing it doesn't.</h2>
        </div>
        <div className="al-service-grid">
          {SERVICES.map((s) => (
            <div key={s.name} className="al-service-card">
              <span className="al-service-icon" aria-hidden="true">{s.icon}</span>
              <strong>{s.name}</strong>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────── */}
      <section className="al-audiences">
        <div className="al-section-head">
          <span className="al-kicker" style={{ marginBottom: '0.65rem' }}>Who it's built for</span>
          <h2>One platform. Every role.</h2>
        </div>
        <div className="al-audience-grid">
          {AUDIENCES.map((a) => (
            <div key={a.tag} className="al-audience-card">
              <span className="al-audience-tag">{a.tag}</span>
              <h3>{a.headline}</h3>
              <p>{a.body}</p>
              <Link to={a.href} className="al-audience-cta">{a.cta} →</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Developer section ────────────────────── */}
      <section className="al-developer">
        <div className="al-dev-inner">
          <div className="al-dev-copy">
            <span className="al-kicker" style={{ marginBottom: '0.65rem' }}>Developer API</span>
            <h2>Ship your first agent in under an hour.</h2>
            <p>
              Streaming responses, tool use, tenant-scoped memory, and voice routing — all
              available over a single REST API. No infrastructure to manage.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <Link to="/artemisChat" className="al-cta-dark">Start building</Link>
              <Link to="/artemisChat" className="al-cta-outline">View docs</Link>
            </div>
          </div>
          <div className="al-dev-code">
            <div className="al-code-bar">
              <span className="al-code-dot" style={{ background: '#ff5f57' }} />
              <span className="al-code-dot" style={{ background: '#febc2e' }} />
              <span className="al-code-dot" style={{ background: '#28c840' }} />
              <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--ag-muted)', letterSpacing: '0.1em' }}>artemis-api.ts</span>
            </div>
            <pre className="al-code-pre"><code>{`const stream = await artemis.chat({
  tenant: "acme-corp",
  agent:  "artemis",
  message: "Summarize last week's runs.",
  stream:  true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.text)
}`}</code></pre>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────── */}
      <section className="al-pricing">
        <div className="al-section-head">
          <span className="al-kicker" style={{ marginBottom: '0.65rem' }}>Pricing</span>
          <h2>Start free. Scale as you grow.</h2>
        </div>
        <div className="al-tier-grid">
          {TIERS.map((t) => (
            <div key={t.name} className={`al-tier${t.highlight ? ' al-tier-highlight' : ''}`}>
              <div className="al-tier-head">
                <span className="al-tier-name">{t.name}</span>
                <div className="al-tier-price">
                  <span className="al-tier-amount">{t.price}</span>
                  <span className="al-tier-sub">{t.sub}</span>
                </div>
              </div>
              <ul className="al-tier-features">
                {t.features.map((f) => (
                  <li key={f}><span aria-hidden="true">✓</span>{f}</li>
                ))}
              </ul>
              <Link to={t.href} className={t.highlight ? 'al-cta-dark' : 'al-cta-outline'}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────── */}
      <section className="al-final-cta">
        <div className="al-final-cta-inner">
          <h2>Ready to run your first agent?</h2>
          <p>Artemis is live. Get started free — no card required.</p>
          <div className="al-hero-actions" style={{ justifyContent: 'center' }}>
            <Link to="/artemisChat" className="al-cta-dark">Enter Artemis →</Link>
            <Link to="/artemisChat" className="al-cta-outline">Talk to us</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="al-footer">
        <div className="al-footer-inner">
          <span className="al-footer-brand">Artemis AI</span>
          <span className="al-footer-copy">© {new Date().getFullYear()} Cutline Industries. All rights reserved.</span>
          <nav className="al-footer-nav" aria-label="Footer">
            <Link to="/artemisChat">Chat</Link>
            <Link to="/artemisChat">Docs</Link>
            <Link to="/artemisChat">Privacy</Link>
          </nav>
        </div>
      </footer>

    </div>
  )
}
