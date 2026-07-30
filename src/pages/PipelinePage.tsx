import { useMemo, useState } from 'react'
import {
  CONTENT_PIPELINE,
  DEMO_TRENDS,
  EXECUTION_LOOP,
  type TrendTopic,
} from '../data/pipeline'

function buildScript(topic: TrendTopic): string {
  return [
    `# ${topic.title}`,
    '',
    `Angle: ${topic.angle}`,
    `Keywords: ${topic.keywords.join(', ')}`,
    '',
    '## Hook (0:00-0:20)',
    `Most players lose rank because they ignore this one pattern in ${topic.keywords[0]}.`,
    '',
    '## Context (0:20-2:00)',
    `Quick breakdown of why ${topic.title.toLowerCase()} matters this week.`,
    '',
    '## Framework (2:00-7:00)',
    '1. Diagnose the mistake',
    '2. Show the correct habit with gameplay',
    '3. Give a drill viewers can run today',
    '',
    '## Payoff (7:00-8:30)',
    'Before/after clip + checklist recap.',
    '',
    '## CTA (8:30-9:00)',
    'Subscribe for daily Shorts + join for the full pack.',
    '',
    '## Shorts cutdowns',
    '- Hook only',
    '- Drill only',
    '- Mistake vs fix',
    '- Final clutch payoff',
  ].join('\n')
}

export function PipelinePage() {
  const [selectedId, setSelectedId] = useState(DEMO_TRENDS[0]?.id ?? '')
  const selected = useMemo(
    () => DEMO_TRENDS.find((t) => t.id === selectedId) ?? DEMO_TRENDS[0],
    [selectedId],
  )
  const script = selected ? buildScript(selected) : ''

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Content Pipeline</h1>
          <p>
            AI + Replit + AWS + YouTube/AdSense — the full Cutline execution machine from trend scan
            to monetized publish.
          </p>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigator.clipboard.writeText(script)}
          >
            Copy AI script draft
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        {EXECUTION_LOOP.map((item) => (
          <article key={item.step} className="panel pack-card">
            <div className="chip ready">Step {item.step}</div>
            <h3 style={{ marginTop: '0.55rem' }}>{item.title}</h3>
            <p style={{ color: 'var(--muted)' }}>{item.text}</p>
          </article>
        ))}
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)' }}>Stack stages</h2>
      <div className="project-grid" style={{ marginBottom: '1rem' }}>
        {CONTENT_PIPELINE.map((step) => (
          <article key={step.id} className="panel pack-card">
            <div className="hashtag-row" style={{ marginBottom: '0.4rem' }}>
              <span className="chip ready">{step.owner}</span>
              <span className="chip draft">{step.stage}</span>
            </div>
            <h3 style={{ marginTop: 0 }}>{step.title}</h3>
            <p style={{ color: 'var(--muted)' }}>{step.detail}</p>
            <div className="hashtag-row">
              {step.outputs.map((o) => (
                <span className="hashtag" key={o}>
                  {o}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="grid-2">
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Trend radar queue</h3>
          <div className="clip-list">
            {DEMO_TRENDS.map((t) => (
              <div
                key={t.id}
                className={`clip-card ${selectedId === t.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(t.id)}
              >
                <div className="score-ring" style={{ ['--p' as string]: t.score }}>
                  <span>{t.score}</span>
                </div>
                <div>
                  <h4>{t.title}</h4>
                  <p>
                    {t.source} · {t.angle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>AI script draft</h3>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              color: 'var(--muted)',
              fontSize: '0.8rem',
              maxHeight: 420,
              overflow: 'auto',
            }}
          >
            {script}
          </pre>
        </section>
      </div>
    </div>
  )
}
