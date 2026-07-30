import { useCallback, useEffect, useState } from 'react'

type Status = {
  brand: string
  domain: string
  hasSecret: boolean
  hasToken: boolean
  dryRun: boolean
  privacy: string
  game: string
  niche: string
  inboxCount: number
  inbox: string[]
  state: {
    processed: Record<string, { at: string; uploads: string[] }>
    lastRun: string | null
    lastError: string | null
    running: boolean
  }
  logTail: string
}

const API = import.meta.env.VITE_API_URL || ''

export function AutopilotPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/autopilot/status`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      setStatus((await res.json()) as Status)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — start API with npm run api`
          : 'API unreachable',
      )
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 8000)
    return () => clearInterval(t)
  }, [load])

  async function saveToken() {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/autopilot/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken.trim() }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error || 'Token save failed')
      setRefreshToken('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runOnce() {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/autopilot/run-once`, { method: 'POST' })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error || 'Run failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const processedCount = status ? Object.keys(status.state.processed).length : 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Autopilot</h1>
          <p>
            Cutline Industries hands-off pipeline: drop VODs in <code>inbox/</code>, Autopilot cuts
            Shorts and uploads to your YouTube channel.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={() => void load()} disabled={busy}>
            Refresh
          </button>
          <button className="btn btn-primary" type="button" onClick={() => void runOnce()} disabled={busy}>
            Run once
          </button>
        </div>
      </div>

      {error ? (
        <div className="panel panel-pad" style={{ marginBottom: '1rem', borderColor: 'rgba(255,93,74,0.45)' }}>
          <p style={{ margin: 0, color: '#ffb0a7' }}>{error}</p>
        </div>
      ) : null}

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">YouTube auth</div>
          <div className={`value ${status?.hasToken ? 'lime' : ''}`}>
            {status?.hasToken ? 'Ready' : 'Needed'}
          </div>
        </div>
        <div className="panel stat">
          <div className="label">Inbox VODs</div>
          <div className="value cyan">{status?.inboxCount ?? '—'}</div>
        </div>
        <div className="panel stat">
          <div className="label">Processed</div>
          <div className="value">{processedCount}</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Connect channel</h3>
          <p style={{ color: 'var(--muted)' }}>
            After OAuth Playground, paste the <strong>refresh_token</strong> once. Autopilot posts
            after that with no more clicks.
          </p>
          <div className="field">
            <label>refresh_token</label>
            <textarea
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="1//0...."
            />
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || !refreshToken.trim()}
            onClick={() => void saveToken()}
          >
            Save token
          </button>
          <div style={{ marginTop: '1rem' }} className="hashtag-row">
            <span className={`chip ${status?.hasSecret ? 'ready' : 'draft'}`}>
              secret {status?.hasSecret ? 'ok' : 'missing'}
            </span>
            <span className={`chip ${status?.hasToken ? 'ready' : 'draft'}`}>
              token {status?.hasToken ? 'ok' : 'missing'}
            </span>
            <span className="chip">{status?.dryRun ? 'dry-run mode' : 'live upload'}</span>
            <span className="chip">{status?.privacy ?? 'private'}</span>
          </div>
        </section>

        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Runtime</h3>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Domain: <strong>{status?.domain ?? 'cutline-industries.studio'}</strong>
            <br />
            Game/niche: {status?.game ?? '—'} / {status?.niche ?? '—'}
            <br />
            Last run: {status?.state.lastRun ?? 'never'}
            <br />
            Last error: {status?.state.lastError ?? 'none'}
          </p>
          <h4 style={{ fontFamily: 'var(--font-display)' }}>Inbox</h4>
          {status?.inbox?.length ? (
            <ul style={{ color: 'var(--muted)', marginTop: 0 }}>
              {status.inbox.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Empty — drop .mp4/.mov files into inbox/</p>
          )}
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Log</h3>
        <pre
          style={{
            margin: 0,
            maxHeight: 280,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            color: 'var(--muted)',
            fontSize: '0.78rem',
          }}
        >
          {status?.logTail || 'No log yet. Start with npm run autopilot'}
        </pre>
      </section>
    </div>
  )
}
