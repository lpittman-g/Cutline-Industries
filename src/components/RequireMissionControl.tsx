import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { fetchAuthConfig, fetchAuthUser, type AuthUser } from '../lib/authApi'

const RANK: Record<string, number> = { user: 1, operator: 2, admin: 3 }

export function RequireMissionControl({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [mcOpen, setMcOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchAuthUser(), fetchAuthConfig()])
      .then(([u, c]) => {
        setUser(u.user)
        setMcOpen(Boolean(c.missionControl?.open))
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Auth check failed')
        setUser(null)
      })
  }, [])

  if (user === undefined) {
    return (
      <div className="public-page panel panel-pad" style={{ margin: '2rem' }}>
        <p>Checking Mission Control access…</p>
      </div>
    )
  }

  if (mcOpen) return <>{children}</>

  if (!user) {
    return (
      <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />
    )
  }

  const role = user.role || 'user'
  if ((RANK[role] ?? 0) < RANK.operator) {
    return (
      <div className="public-page panel panel-pad" style={{ margin: '2rem', maxWidth: 520 }}>
        <h1>Mission Control locked</h1>
        <p style={{ color: 'var(--muted)' }}>
          Signed in as {user.email} ({role}). Operator or admin role required.
        </p>
        {error && <p className="chip warn">{error}</p>}
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Set <code>AUTH_BOOTSTRAP_ADMIN_EMAIL</code> before signup, or ask an admin to promote you via{' '}
          <code>POST /api/auth/users/:id/role</code>. Local bypass: <code>AUTH_MC_OPEN=1</code>.
        </p>
        <Link className="btn" to="/">
          ← Public site
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
