import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchAuthUser, logout, signin, type AuthUser } from '../lib/authApi'
import {
  CONSOLE_VIEWS,
  UPLOAD_ACCEPT,
  UPLOAD_LABELS,
  UPLOAD_MAX_BYTES,
  isAllowedUpload,
  parseConsoleView,
  parseQuiverEngine,
  type ConsoleView,
  type QuiverEngine,
} from '../lib/artemis'
import { uid } from '../lib/utils'
import { BowChat } from '../components/artemis/BowChat'
import { MemoryBoard } from '../components/artemis/MemoryBoard'
import { uploadArtemisFile } from '../lib/artemisApi'

type QueueItem = { id: string; name: string; status: string; percent: number }

const API = import.meta.env.VITE_API_URL || ''

export function ArtemisConsolePage() {
  const [params, setParams] = useSearchParams()
  const view = parseConsoleView(params.get('view'))
  const engine = parseQuiverEngine(params.get('engine'))
  const showLunar = params.get('panel') === 'lunar'

  const setView = (next: ConsoleView, extras?: Record<string, string>) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('view', next)
    if (next !== 'files') nextParams.delete('engine')
    if (next !== 'logs') nextParams.delete('panel')
    if (next !== 'memory') nextParams.delete('section')
    if (extras) {
      for (const [k, v] of Object.entries(extras)) nextParams.set(k, v)
    }
    setParams(nextParams, { replace: true })
  }

  return (
    <div className="artemis-console">
      <div className="artemis-view-nav" role="tablist" aria-label="Artemis workspace views">
        {CONSOLE_VIEWS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={view === tab.id ? 'artemis-tab is-active' : 'artemis-tab'}
            onClick={() => setView(tab.id, tab.id === 'files' ? { engine } : undefined)}
          >
            {tab.label}
            <span className="artemis-tab-suffix">{tab.suffix}</span>
          </button>
        ))}
        <div className="artemis-online">
          <span className="artemis-status-dot" aria-hidden="true" />
          Workspace Online
        </div>
      </div>

      <div className="artemis-console-panel">
        {view === 'chat' && (
          <BowChat onOpenChronicle={(section) => setView('memory', { section: section ?? 'projects' })} />
        )}
        {view === 'memory' && <MemoryBoard />}
        {view === 'files' && (
          <QuiverPanel
            engine={engine}
            onEngine={(next) => setView('files', { engine: next })}
          />
        )}
        {view === 'logs' && <LogsPanel focusLunar={showLunar} />}
      </div>
    </div>
  )
}

function QuiverPanel({
  engine,
  onEngine,
}: {
  engine: QuiverEngine
  onEngine: (next: QuiverEngine) => void
}) {
  const orionInput = useRef<HTMLInputElement>(null)
  const ironInput = useRef<HTMLInputElement>(null)
  const [orionQueue, setOrionQueue] = useState<QueueItem[]>([])
  const [ironQueue, setIronQueue] = useState<QueueItem[]>([])
  const [ironBanner, setIronBanner] = useState('')
  const [orionOver, setOrionOver] = useState(false)
  const [ironOver, setIronOver] = useState(false)

  const ingest = (files: FileList | null, kind: QuiverEngine) => {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const id = uid(kind)
      const setQueue = kind === 'orion' ? setOrionQueue : setIronQueue
      if (file.size > UPLOAD_MAX_BYTES) {
        setQueue((q) => [...q, { id, name: file.name, status: 'File exceeds 25MB', percent: 0 }])
        continue
      }
      if (!isAllowedUpload(file.name)) {
        setQueue((q) => [...q, { id, name: file.name, status: 'Unsupported type', percent: 0 }])
        continue
      }
      setQueue((q) => [...q, { id, name: file.name, status: 'Uploading 0%', percent: 0 }])
      void uploadArtemisFile(file, {
        source: 'quiver',
        onProgress: (percent) => {
          setQueue((q) =>
            q.map((item) => (item.id === id ? { ...item, percent, status: `Uploading ${percent}%` } : item)),
          )
        },
      })
        .then((result) => {
          const stored = result.stub ? `Stored (stub) · ${result.stored.extract}` : `Stored · ${result.stored.extract}`
          setQueue((q) => q.map((item) => (item.id === id ? { ...item, percent: 100, status: stored } : item)))
          if (kind === 'iron') setIronBanner(stored)
        })
        .catch((err) => {
          const fail = err instanceof Error ? err.message : 'Upload failed'
          setQueue((q) => q.map((item) => (item.id === id ? { ...item, status: fail } : item)))
        })
    }
  }

  return (
    <div className="artemis-quiver">
      <div className="artemis-quiver-head">
        <div>
          <h2>
            <span aria-hidden="true">⋔</span> The Quiver
          </h2>
          <p>Universal file stack ingestion engine for Artemis AI</p>
        </div>
        <span className="artemis-badge">{engine === 'orion' ? 'Orion Vector Active' : 'Iron Forge Active'}</span>
      </div>

      <div className="artemis-quiver-layout">
        <div className="artemis-engine-rail" role="tablist" aria-label="Quiver data engines">
          <button
            type="button"
            role="tab"
            aria-selected={engine === 'orion'}
            className={engine === 'orion' ? 'is-active' : undefined}
            onClick={() => onEngine('orion')}
          >
            <strong>The Orion Store</strong>
            <span>Local Vector Pool</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={engine === 'iron'}
            className={engine === 'iron' ? 'is-active' : undefined}
            onClick={() => onEngine('iron')}
          >
            <strong>The Iron Forge</strong>
            <span>Enterprise Microsoft Stack</span>
          </button>
        </div>

        {engine === 'orion' ? (
          <div>
            <div
              className={`artemis-drop${orionOver ? ' is-over' : ''}`}
              onClick={() => orionInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setOrionOver(true)
              }}
              onDragLeave={() => setOrionOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOrionOver(false)
                ingest(e.dataTransfer.files, 'orion')
              }}
            >
              <input
                ref={orionInput}
                type="file"
                multiple
                hidden
                accept={UPLOAD_ACCEPT}
                onChange={(e) => ingest(e.target.files, 'orion')}
              />
              <p>
                Drag &amp; drop your files here, or <span>browse</span>
              </p>
              <small>{UPLOAD_LABELS.join(', ')} · up to 25MB · stored in knowledge/</small>
            </div>
            {orionQueue.length > 0 && (
              <ul className="artemis-queue" aria-label="Orion upload progress">
                {orionQueue.map((item) => (
                  <li key={item.id}>
                    <div>
                      <span>{item.name}</span>
                      <em>{item.status}</em>
                    </div>
                    <div
                      className="artemis-upload-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.percent}
                    >
                      <span style={{ width: `${item.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="artemis-iron">
            <div className="artemis-iron-head">
              <div>
                <h3>The Iron Forge</h3>
                <p>SharePoint · Azure Blob · Fletcher Suite Document Intelligence</p>
              </div>
              <span className="artemis-badge">Stack Linked</span>
            </div>
            <div
              className={`artemis-drop${ironOver ? ' is-over' : ''}`}
              onClick={() => ironInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIronOver(true)
              }}
              onDragLeave={() => setIronOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIronOver(false)
                ingest(e.dataTransfer.files, 'iron')
              }}
            >
              <input
                ref={ironInput}
                type="file"
                multiple
                hidden
                accept={UPLOAD_ACCEPT}
                onChange={(e) => ingest(e.target.files, 'iron')}
              />
              <p>Route enterprise files into The Iron Forge</p>
              <small>{UPLOAD_LABELS.join(', ')} · Fletcher Suite + knowledge/</small>
            </div>
            {ironQueue.length > 0 && (
              <ul className="artemis-queue" aria-label="Iron Forge upload progress">
                {ironQueue.map((item) => (
                  <li key={item.id}>
                    <div>
                      <span>{item.name}</span>
                      <em>{item.status}</em>
                    </div>
                    <div
                      className="artemis-upload-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.percent}
                    >
                      <span style={{ width: `${item.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {ironBanner && <p className="artemis-banner">{ironBanner}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function LogsPanel({ focusLunar }: { focusLunar: boolean }) {
  const userRef = useRef<HTMLInputElement>(null)
  const [health, setHealth] = useState('Probing…')
  const [metrics, setMetrics] = useState('Awaiting telemetry...')
  const [authStatus, setAuthStatus] = useState('Lunar Gate idle')
  const [tribute, setTribute] = useState('Scout / checking...')
  const [user, setUser] = useState<AuthUser | null>(null)

  const refresh = async () => {
    try {
      const res = await fetch(`${API}/api/health`, { credentials: 'include' })
      const data = (await res.json()) as { ok?: boolean; service?: string }
      setHealth(data.ok ? `Online · ${data.service || 'artemis-public-api'}` : 'Degraded')
      setMetrics(JSON.stringify(data, null, 2))
    } catch {
      setHealth('Unreachable')
    }
    try {
      const res = await fetch(`${API}/api/tribute/status`, { credentials: 'include' })
      if (!res.ok) throw new Error('unavailable')
      const data = (await res.json()) as {
        profile?: { tribute_tier?: string; credits_used_this_month?: number; monthly_token_credit?: number }
      }
      const p = data.profile ?? {}
      setTribute(`${p.tribute_tier || 'Scout'} · ${p.credits_used_this_month || 0} / ${p.monthly_token_credit || 50000}`)
    } catch {
      setTribute('Tribute status unavailable')
    }
  }

  useEffect(() => {
    void refresh()
    void fetchAuthUser()
      .then((r) => {
        setUser(r.user)
        setAuthStatus(r.user ? `Authenticated · ${r.user.email}` : 'Lunar Gate idle')
      })
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    if (focusLunar) userRef.current?.focus()
  }, [focusLunar])

  return (
    <div className="artemis-logs">
      <div>
        <h2>Logs</h2>
        <p>Security, authentication, and background model metrics.</p>
      </div>
      <div className="artemis-log-grid">
        <article>
          <p>Auth Gate</p>
          <strong>{authStatus}</strong>
        </article>
        <article>
          <p>Tribute Credits</p>
          <strong>{tribute}</strong>
        </article>
        <article>
          <p>API Health</p>
          <strong>{health}</strong>
        </article>
      </div>
      <section>
        <div className="artemis-log-head">
          <h3>Background model metrics</h3>
          <button type="button" className="artemis-chip-btn" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <pre className="artemis-terminal">{metrics}</pre>
      </section>
      <section>
        <h3>Security &amp; identity</h3>
        <p>Lunar Gate credentials feed Core Control. Successful auth is mirrored here.</p>
        <LunarGate
          userRef={userRef}
          user={user}
          onUser={(next) => {
            setUser(next)
            setAuthStatus(next ? `Authenticated · ${next.email}` : 'Lunar Gate idle')
          }}
        />
      </section>
    </div>
  )
}

function LunarGate({
  userRef,
  user,
  onUser,
}: {
  userRef: RefObject<HTMLInputElement | null>
  user: AuthUser | null
  onUser: (user: AuthUser | null) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await signin({ email, password })
      onUser(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    try {
      await logout()
    } catch {
      /* ignore */
    }
    onUser(null)
  }

  if (user) {
    return (
      <div className="artemis-lunar-session">
        <p>
          Gate open for <strong>{user.displayName || user.email}</strong>
        </p>
        <div className="artemis-hero-actions">
          <Link className="artemis-cta-primary artemis-cta-compact" to="/app/dashboard">
            Enter Core Control
          </Link>
          <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="artemis-lunar" onSubmit={(e) => void submit(e)}>
      <div>
        <h2>Lunar Gate</h2>
        <p>Identity verification portal — enter Artemis Core Control.</p>
      </div>
      <label htmlFor="lunar-user">Profile User ID</label>
      <input
        ref={userRef}
        id="lunar-user"
        name="username"
        type="text"
        autoComplete="username"
        required
        placeholder="Profile User ID"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label htmlFor="lunar-pass">Security Parameter Password</label>
      <input
        id="lunar-pass"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Security Parameter Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="artemis-error">{error}</p>}
      <button type="submit" className="artemis-cta-primary artemis-cta-compact" disabled={busy}>
        {busy ? 'Authenticating…' : 'Authenticate Parameters'}
      </button>
    </form>
  )
}
