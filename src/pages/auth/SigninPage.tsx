import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signin } from '../../lib/authApi'

export function SigninPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signin({
        email,
        password,
        mfaCode: mfaRequired ? mfaCode : undefined,
      })
      navigate('/app/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      if (msg.toLowerCase().includes('mfa')) setMfaRequired(true)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Sign in</h1>
          <p>Cutline Industries · Thermal Mission Control</p>
        </div>
      </div>

      {error && <p className="chip warn">{error}</p>}

      <section className="panel panel-pad" style={{ maxWidth: 480 }}>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
            <input
              className="btn"
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="btn"
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {mfaRequired && (
              <input
                className="btn"
                type="text"
                required
                placeholder="MFA / recovery code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                autoComplete="one-time-code"
              />
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
        <p style={{ marginTop: '1rem' }}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </div>
  )
}
