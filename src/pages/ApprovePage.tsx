import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787'

function getOrCreateDeviceId() {
  const key = 'cutline_approval_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

type Approval = {
  id: string
  service: string
  detail: string
  desktopUrl: string | null
  status: string
  createdAt: string
}

export function ApprovePage() {
  const params = new URLSearchParams(window.location.search)
  const approvalId = params.get('id')
  const deviceId = useMemo(() => getOrCreateDeviceId(), [])
  const [label, setLabel] = useState(localStorage.getItem('cutline_device_label') || 'My iPhone')
  const [approval, setApproval] = useState<Approval | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const register = useCallback(async () => {
    await fetch(`${API}/api/approval/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, label, userAgent: navigator.userAgent }),
    })
    localStorage.setItem('cutline_device_label', label)
  }, [deviceId, label])

  useEffect(() => {
    register().catch(() => undefined)
  }, [register])

  useEffect(() => {
    if (!approvalId) {
      setStatus('ready')
      setMessage('Waiting for agent approval requests… Keep this page bookmarked or install the ntfy app.')
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/approval/${approvalId}`)
        if (!res.ok) throw new Error('Not found')
        const data = (await res.json()) as Approval
        if (!cancelled) {
          setApproval(data)
          setStatus(data.status === 'pending' ? 'ready' : 'done')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    load()
    const timer = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [approvalId])

  async function decide(decision: 'approved' | 'denied') {
    if (!approvalId) return
    setStatus('loading')
    const res = await fetch(`${API}/api/approval/${approvalId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, deviceId }),
    })
    if (!res.ok) {
      setStatus('error')
      return
    }
    const data = (await res.json()) as Approval
    setApproval(data)
    setStatus('done')
  }

  async function onSaveLabel(e: FormEvent) {
    e.preventDefault()
    await register()
    setMessage('Device paired. Install ntfy and subscribe to your Cutline topic (see API status).')
  }

  return (
    <article className="page feedback-page approve-page">
      <header className="page-header">
        <p className="eyebrow">Cutline agent approval</p>
        <h1>Approve sign-ins from your phone</h1>
        <p>
          No Apple Developer account required. Your device is identified by a generated ID — we never
          use your Apple serial number.
        </p>
      </header>

      <form className="card feedback-form" onSubmit={onSaveLabel}>
        <label htmlFor="device-label">Device name</label>
        <input
          id="device-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Lamont's iPhone"
        />
        <p className="muted">Device ID: {deviceId.slice(0, 8)}…</p>
        <button className="btn btn-primary" type="submit">
          Save pairing
        </button>
      </form>

      {approval && (
        <section className="card feedback-stats">
          <h2>{approval.service}</h2>
          <p>{approval.detail || 'Agent needs your approval to continue.'}</p>
          {approval.desktopUrl && (
            <p>
              <a href={approval.desktopUrl} target="_blank" rel="noreferrer">
                Open agent desktop
              </a>
            </p>
          )}
          {approval.status === 'pending' ? (
            <div className="approve-actions">
              <button className="btn btn-primary" type="button" onClick={() => decide('approved')}>
                Approve
              </button>
              <button className="btn" type="button" onClick={() => decide('denied')}>
                Deny
              </button>
            </div>
          ) : (
            <p className="ok">Decision: {approval.status}</p>
          )}
        </section>
      )}

      {!approval && status === 'ready' && <p className="card">{message}</p>}
      {status === 'error' && <p className="err card">Could not load approval request.</p>}
    </article>
  )
}
