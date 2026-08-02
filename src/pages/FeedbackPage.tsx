import { useEffect, useState, type FormEvent } from 'react'
import { PROJECT } from '../data/projectContentPublic'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787'

type FeedbackReport = {
  insights: { title: string; views: number; likes: number; comments: number }[]
  winning_hooks: string[]
  audience_requests: string[]
  next_topic_suggestions: string[]
}

export function FeedbackPage() {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [report, setReport] = useState<FeedbackReport | null>(null)

  useEffect(() => {
    fetch(`${API}/api/ai-pipeline/feedback`)
      .then((r) => r.json())
      .then((d) => setReport(d.report ?? null))
      .catch(() => setReport(null))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('sending')
    try {
      const res = await fetch(`${API}/api/ai-pipeline/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), source: 'site' }),
      })
      if (!res.ok) throw new Error('Failed')
      setMessage('')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <article className="page feedback-page">
      <header className="page-header">
        <p className="eyebrow">{PROJECT.product} content lab</p>
        <h1>Shape our next Shorts</h1>
        <p>
          {PROJECT.brand} publishes AI-made Shorts about {PROJECT.product} — stream heat, clip
          unlocks, bounty boards, and indie dev ad packs. Tell us what to cover next; your input
          feeds the next video batch.
        </p>
      </header>

      <form className="card feedback-form" onSubmit={onSubmit}>
        <label htmlFor="feedback-msg">What should we explain or demo next?</label>
        <textarea
          id="feedback-msg"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Example: Show how Discord unlock works during a live Valorant clutch…"
        />
        <button className="btn btn-primary" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send to content autopilot'}
        </button>
        {status === 'sent' && <p className="ok">Got it — the AI pipeline reads this before the next run.</p>}
        {status === 'error' && <p className="err">Could not reach API. Try again or email {PROJECT.email}.</p>}
      </form>

      {report && (
        <section className="card feedback-stats">
          <h2>Public pulse (from YouTube + your inputs)</h2>
          {report.insights.length > 0 && (
            <ul>
              {report.insights.slice(0, 5).map((v) => (
                <li key={v.title}>
                  <strong>{v.title}</strong> — {v.views} views · {v.likes} likes · {v.comments}{' '}
                  comments
                </li>
              ))}
            </ul>
          )}
          {report.next_topic_suggestions.length > 0 && (
            <>
              <h3>Queued next</h3>
              <ul>
                {report.next_topic_suggestions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          {report.audience_requests.length > 0 && (
            <>
              <h3>Recent requests</h3>
              <ul>
                {report.audience_requests.slice(0, 5).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </article>
  )
}
