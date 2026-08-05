import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { exchangeRampCode } from '../lib/rampApi'

/**
 * OAuth redirect target registered in Ramp:
 * https://cutline-industries.studio/callback
 */
export function RampCallbackPage() {
  const [params] = useSearchParams()
  const code = params.get('code')
  const state = params.get('state')
  const oauthError = params.get('error')
  const [status, setStatus] = useState<'idle' | 'exchanging' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (oauthError) {
      setStatus('error')
      setMessage(params.get('error_description') || oauthError)
      return
    }
    if (!code) {
      setStatus('error')
      setMessage('No authorization code in URL. Start from Mission Control → Ramp spend → Authorize.')
      return
    }
    let cancelled = false
    setStatus('exchanging')
    void (async () => {
      try {
        const result = await exchangeRampCode(code)
        if (cancelled) return
        setStatus('done')
        setMessage(
          `Connected. Scope: ${result.scope || 'n/a'}${
            result.hasRefreshToken ? ' · refresh token stored' : ''
          }`,
        )
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'Token exchange failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, oauthError, params])

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Ramp callback</h1>
          <p>Authorization code landing page for Cutline ↔ Ramp (demo).</p>
        </div>
      </div>

      {status === 'exchanging' && <p className="chip">Exchanging code…</p>}
      {status === 'done' && <p className="chip ready">{message}</p>}
      {status === 'error' && <p className="chip warn">{message}</p>}

      {state && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>state: {state}</p>
      )}

      <p>
        <Link to="/app/ramp">→ Ramp spend (Mission Control)</Link>
      </p>
    </div>
  )
}
