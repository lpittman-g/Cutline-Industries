import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchAuthUser, logout, signin, type AuthUser } from '../lib/authApi'
import {
  BOW_MODELS,
  CONSOLE_VIEWS,
  formatHuntHistory,
  loadHunts,
  parseConsoleView,
  parseQuiverEngine,
  saveHunts,
  type BowModel,
  type ConsoleView,
  type HuntThread,
  type QuiverEngine,
} from '../lib/artemis'
import { uid } from '../lib/utils'

type QueueItem = { id: string; name: string; status: string }

const API = import.meta.env.VITE_API_URL || ''

function dryRunBow(prompt: string, model: BowModel): string {
  return [
    `[${model}]`,
    'Bow dry-run — execution API is not connected in this environment.',
    '',
    prompt,
    '',
    'Artemis received the prompt and is ready to route it through The Bow when the engine is online.',
  ].join('\n')
}

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
            <span>{tab.suffix}</span>
          </button>
        ))}
        <div className="artemis-online">
          <span className="artemis-status-dot" aria-hidden="true" />
          Workspace Online
        </div>
      </div>

      <div className="artemis-console-panel">
        {view === 'chat' && <BowPanel />}
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

function BowPanel() {
  const [hunts, setHunts] = useState<HuntThread[]>(() => (typeof localStorage === 'undefined' ? [] : loadHunts()))
  const [activeId, setActiveId] = useState<string | null>(hunts[0]?.id ?? null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<BowModel>('Artemis Core')
  const [output, setOutput] = useState(() =>
    hunts[0] ? formatHuntHistory(hunts[0].messages) : '',
  )
  const [busy, setBusy] = useState(false)

  const persist = (next: HuntThread[]) => {
    setHunts(next)
    saveHunts(next)
  }

  const openHunt = (id: string) => {
    setActiveId(id)
    const hunt = hunts.find((h) => h.id === id)
    setOutput(hunt ? formatHuntHistory(hunt.messages) : '')
  }

  const newHunt = () => {
    const thread: HuntThread = {
      id: uid('hunt'),
      title: 'Untitled Hunt',
      engine: model,
      messages: [],
    }
    persist([thread, ...hunts])
    setActiveId(thread.id)
    setPrompt('')
    setOutput('')
  }

  const fire = async () => {
    const text = prompt.trim()
    if (!text) {
      setOutput('Enter a prompt before firing The Bow.')
      return
    }
    setBusy(true)
    setOutput('')
    try {
      const res = await fetch(`${API}/api/bow/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, text/plain, application/json' },
        body: JSON.stringify({ prompt: text, model_selection: model, thread_id: activeId }),
      })
      let reply = ''
      if (res.ok) {
        reply = await res.text()
      } else {
        reply = dryRunBow(text, model)
      }
      const threadId = res.headers.get('X-Chronicler-Thread-Id') || activeId || uid('hunt')
      const title = text.slice(0, 48) || 'Untitled Hunt'
      const existing = hunts.find((h) => h.id === threadId)
      const messages = [
        ...(existing?.messages ?? []),
        { role: 'operator' as const, content: text },
        { role: 'artemis' as const, content: reply },
      ]
      const nextThread: HuntThread = {
        id: threadId,
        title: existing?.title && existing.title !== 'Untitled Hunt' ? existing.title : title,
        engine: model,
        messages,
      }
      persist([nextThread, ...hunts.filter((h) => h.id !== threadId)])
      setActiveId(threadId)
      setOutput(formatHuntHistory(messages))
      setPrompt('')
    } catch {
      const reply = dryRunBow(text, model)
      setOutput(reply)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="artemis-bow">
      <aside className="artemis-chronicler">
        <div className="artemis-chronicler-head">
          <span>Chronicler</span>
          <button type="button" className="artemis-chip-btn" onClick={newHunt}>
            New Hunt
          </button>
        </div>
        {hunts.length === 0 ? (
          <p className="artemis-empty">No hunts yet. Fire The Bow to begin.</p>
        ) : (
          <ul>
            {hunts.map((hunt) => (
              <li key={hunt.id}>
                <button
                  type="button"
                  className={hunt.id === activeId ? 'is-active' : undefined}
                  onClick={() => openHunt(hunt.id)}
                >
                  {hunt.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="artemis-bow-main">
        <div>
          <h2>The Bow</h2>
          <p>Premium multi-model execution and generation console.</p>
        </div>
        <label htmlFor="bow-prompt">Prompt</label>
        <textarea
          id="bow-prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Draw the string — describe what Artemis should generate..."
        />
        <div className="artemis-bow-actions">
          <select value={model} onChange={(e) => setModel(e.target.value as BowModel)} aria-label="Model">
            {BOW_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button type="button" className="artemis-cta-primary artemis-cta-compact" disabled={busy} onClick={() => void fire()}>
            {busy ? 'Firing…' : 'Fire'}
          </button>
        </div>
        <pre className="artemis-terminal">{output}</pre>
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
    const accepted = Array.from(files).filter((f) => f.size <= 25 * 1024 * 1024)
    for (const file of accepted) {
      const id = uid(kind)
      if (kind === 'orion') {
        setOrionQueue((q) => [...q, { id, name: file.name, status: 'Parsing…' }])
        window.setTimeout(() => {
          setOrionQueue((q) => q.map((item) => (item.id === id ? { ...item, status: 'Stored in Orion' } : item)))
        }, 1600)
      } else {
        setIronQueue((q) => [...q, { id, name: file.name, status: 'Passing parameters to The Fletcher Suite…' }])
        setIronBanner('Passing parameters to The Fletcher Suite…')
        window.setTimeout(() => {
          setIronQueue((q) =>
            q.map((item) => (item.id === id ? { ...item, status: 'Indexing coordinates inside The Cyclops Vault…' } : item)),
          )
          setIronBanner('Indexing coordinates inside The Cyclops Vault…')
        }, 1600)
        window.setTimeout(() => {
          setIronQueue((q) =>
            q.map((item) => (item.id === id ? { ...item, status: 'The Bloodhound Protocol is now active.' } : item)),
          )
          setIronBanner('The Bloodhound Protocol is now active.')
        }, 3200)
      }
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
                accept=".pdf,.docx,.xlsx,.csv,.txt"
                onChange={(e) => ingest(e.target.files, 'orion')}
              />
              <p>
                Drag &amp; drop your files here, or <span>browse</span>
              </p>
              <small>Supports PDF, DOCX, XLSX, CSV, and TXT files up to 25MB</small>
            </div>
            {orionQueue.length > 0 && (
              <ul className="artemis-queue">
                {orionQueue.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <em>{item.status}</em>
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
                accept=".pdf,.docx,.xlsx,.csv,.txt,.pptx"
                onChange={(e) => ingest(e.target.files, 'iron')}
              />
              <p>Route enterprise files into The Iron Forge</p>
              <small>Fletcher Suite parses SharePoint / Blob sources before Cyclops indexing</small>
            </div>
            {ironQueue.length > 0 && (
              <ul className="artemis-queue">
                {ironQueue.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <em>{item.status}</em>
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
