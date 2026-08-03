import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchAuthConfig, signup, type AuthConfigPublic } from '../../lib/authApi'

export function SignupPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<AuthConfigPublic | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchAuthConfig()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Config unavailable'))
  }, [])

  const policy = config?.signUp.passwordPolicy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    setVerifyUrl(null)
    try {
      const result = await signup({
        email,
        password,
        displayName: displayName.trim() || undefined,
      })
      setMessage(result.message)
      if (result.verificationUrl) setVerifyUrl(result.verificationUrl)
      if (!result.requiresEmailVerification) navigate('/signin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Create account</h1>
          <p>Cutline Industries · Thermal on cutline-industries.studio</p>
        </div>
      </div>

      {error && <p className="chip warn">{error}</p>}
      {message && <p className="chip ready">{message}</p>}
      {verifyUrl && (
        <p className="chip">
          Dev verify link:{' '}
          <a href={verifyUrl}>{verifyUrl}</a>
        </p>
      )}

      <section className="panel panel-pad" style={{ maxWidth: 480 }}>
        {config && !config.signUp.allowPublicRegistration ? (
          <p>Public registration is disabled.</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
              <input
                className="btn"
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
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
                autoComplete="new-password"
              />
              {policy && (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
                  Min {policy.min_length} chars
                  {policy.require_uppercase ? ' · uppercase' : ''}
                  {policy.require_numbers ? ' · number' : ''}
                  {policy.require_special_characters ? ' · special' : ''}
                  {config?.signUp.requireEmailVerification ? ' · email verification required' : ''}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Creating…' : 'Sign up'}
              </button>
            </div>
          </form>
        )}
        <p style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </section>
    </div>
  )
}
