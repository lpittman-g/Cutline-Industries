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

type GoogleStatus = {
  accountEmailHint?: string
  projectId?: string | null
  oauth?: {
    hasClientSecret: boolean
    hasRefreshToken: boolean
    authorized: boolean
    scopes?: string[]
  }
  links?: {
    oauthCredentials: string
    oauthConsentScreen: string
    enableYoutubeDataApi: string
    enableGmailApi: string
    oauthPlayground: string
  }
  nextSteps?: string[]
}

const API = import.meta.env.VITE_API_URL || ''

export function AutopilotPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [google, setGoogle] = useState<GoogleStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [statusRes, googleRes] = await Promise.all([
        fetch(`${API}/api/autopilot/status`),
        fetch(`${API}/api/google/status`),
      ])
      if (!statusRes.ok) throw new Error(`API ${statusRes.status}`)
      setStatus((await statusRes.json()) as Status)
      if (googleRes.ok) setGoogle((await googleRes.json()) as GoogleStatus)
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

  async function exchangeCode() {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/google/oauth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim() }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string; hasRefreshToken?: boolean }
      if (!res.ok) throw new Error(body.error || 'Code exchange failed')
      setAuthCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function openOAuth() {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/google/oauth/url`)
      const body = (await res.json()) as { ok?: boolean; url?: string; error?: string }
      if (!res.ok || !body.url) throw new Error(body.error || 'Could not build OAuth URL')
      window.open(body.url, '_blank', 'noopener,noreferrer')
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
  const links = google?.links

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
            Run auto
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
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Connect YouTube + Gmail</h3>
          <p style={{ color: 'var(--muted)' }}>
            Authorize <strong>YouTube</strong> and <strong>gmail.send</strong> scopes, then save the
            refresh token to <code>token.json</code>. Sign in as{' '}
            {google?.accountEmailHint || 'lpittman@cutline-industries.studio'}.
          </p>

          {links ? (
            <ul style={{ color: 'var(--muted)', paddingLeft: '1.1rem', lineHeight: 1.7, fontSize: '0.9rem' }}>
              <li>
                <a href={links.oauthCredentials} target="_blank" rel="noreferrer">
                  OAuth credentials
                </a>
              </li>
              <li>
                <a href={links.oauthConsentScreen} target="_blank" rel="noreferrer">
                  OAuth consent screen
                </a>
              </li>
              <li>
                <a href={links.enableYoutubeDataApi} target="_blank" rel="noreferrer">
                  Enable YouTube Data API
                </a>
              </li>
              <li>
                <a href={links.enableGmailApi} target="_blank" rel="noreferrer">
                  Enable Gmail API
                </a>
              </li>
              <li>
                <a href={links.oauthPlayground} target="_blank" rel="noreferrer">
                  OAuth Playground
                </a>
              </li>
            </ul>
          ) : null}

          <div className="btn-row" style={{ marginBottom: '1rem' }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !status?.hasSecret}
              onClick={() => void openOAuth()}
            >
              Open OAuth
            </button>
          </div>

          <div className="field">
            <label>Authorization code</label>
            <textarea
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="4/0A..."
            />
          </div>
          <button
            className="btn"
            type="button"
            disabled={busy || !authCode.trim()}
            onClick={() => void exchangeCode()}
            style={{ marginBottom: '1rem' }}
          >
            Exchange code → token.json
          </button>

          <div className="field">
            <label>refresh_token (alternate)</label>
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
          {google?.nextSteps?.length ? (
            <ol style={{ color: 'var(--muted)', paddingLeft: '1.1rem', lineHeight: 1.6, fontSize: '0.85rem' }}>
              {google.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </section>

        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Runtime</h3>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Domain: <strong>{status?.domain ?? 'cutline-industries.studio'}</strong>
            <br />
            Project: {google?.projectId ?? '—'}
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
          {status?.logTail || 'No log yet'}
        </pre>
      </section>
    </div>
  )
}
