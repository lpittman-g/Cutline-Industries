import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchAuthUser, type AuthUser } from '../lib/authApi'

export function RequireArtemisAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    void fetchAuthUser()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <p style={{ color: 'var(--muted, #888)', fontSize: '0.9rem' }}>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <>{children}</>
}
