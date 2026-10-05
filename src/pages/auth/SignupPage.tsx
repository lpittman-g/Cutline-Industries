import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchAuthConfig, signup, oauthSigninUrl, type AuthConfigPublic } from '../../lib/authApi'
import { ArtemisMark } from '../../components/artemis/ArtemisMark'

function OAuthButton({
  provider,
  logo,
  label,
}: {
  provider: 'google' | 'microsoft' | 'apple'
  logo: React.ReactNode
  label: string
}) {
  return (
    <button type="button" className="auth-oauth-btn" onClick={() => { window.location.href = oauthSigninUrl(provider) }}>
      <span className="auth-oauth-logo" aria-hidden="true">{logo}</span>
      <span>{label}</span>
    </button>
  )
}

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
      const result = await signup({ email, password, displayName: displayName.trim() || undefined })
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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <ArtemisMark size={36} />
          <span>Artemis AI</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Deploy your first autonomous agent for free</p>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        {verifyUrl && (
          <p className="auth-info">
            Verify link (dev): <a href={verifyUrl} style={{ wordBreak: 'break-all' }}>{verifyUrl}</a>
          </p>
        )}

        {config && !config.signUp.allowPublicRegistration ? (
          <p className="auth-info">Public registration is currently invite-only.</p>
        ) : (
          <>
            {/* OAuth providers */}
            <div className="auth-oauth-stack">
              <OAuthButton
                provider="google"
                label="Sign up with Google"
                logo={
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                }
              />
              <OAuthButton
                provider="microsoft"
                label="Sign up with Microsoft"
                logo={
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022"/>
                    <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00"/>
                    <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF"/>
                    <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900"/>
                  </svg>
                }
              />
              <OAuthButton
                provider="apple"
                label="Sign up with Apple"
                logo={
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M12.624 0c.065.924-.268 1.862-.851 2.537-.58.672-1.497 1.17-2.395 1.098-.085-.898.31-1.831.862-2.472C10.808.503 11.75.043 12.624 0zM15.999 12.602c-.363.826-.537 1.195-1.003 1.926-.65 1.01-1.567 2.268-2.704 2.28-1.009.012-1.269-.658-2.638-.65-1.368.008-1.659.664-2.668.654-1.137-.012-1.999-1.155-2.65-2.165C2.556 12.425 2.02 9.955 2.876 8.19c.6-1.247 1.73-1.987 2.895-1.987 1.135 0 1.848.66 2.789.66.91 0 1.465-.661 2.773-.661 1.046 0 2.04.6 2.643 1.636-2.322 1.273-1.946 4.589.023 5.764z"/>
                  </svg>
                }
              />
            </div>

            <div className="auth-divider"><span>or sign up with email</span></div>

            <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
              <label className="auth-label">
                Display name <span className="auth-optional">(optional)</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="auth-input"
                />
              </label>
              <label className="auth-label">
                Email
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="auth-input"
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="auth-input"
                />
                {policy && (
                  <span className="auth-hint">
                    Min {policy.min_length} chars
                    {policy.require_uppercase ? ' · uppercase' : ''}
                    {policy.require_numbers ? ' · number' : ''}
                    {policy.require_special_characters ? ' · special char' : ''}
                    {config?.signUp.requireEmailVerification ? ' · email verification' : ''}
                  </span>
                )}
              </label>
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </>
        )}

        <p className="auth-footer-link">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
