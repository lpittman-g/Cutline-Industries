import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { fetchAuthUser, logout, type AuthUser } from '../lib/authApi'
import { THERMAL } from '../data/thermal'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/bounty', label: 'Bounty Board' },
  { to: '/developers', label: 'Developers' },
  { to: '/feedback', label: 'Content input' },
  { to: '/approve', label: 'Agent approve' },
]

export function PublicShell() {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    void fetchAuthUser()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* ignore */
    }
    setUser(null)
  }

  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand public-brand">
          <div className="brand-mark thermal-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE INDUSTRIES</strong>
            <span>Thermal · heat → shorts → cash</span>
          </div>
        </Link>
        <nav className="public-nav-links">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <span className="chip ready">{user.displayName || user.email}</span>
              <button type="button" className="btn" onClick={() => void handleLogout()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="btn" to="/signin">
                Sign in
              </Link>
              <Link className="btn btn-primary" to="/signup">
                Sign up
              </Link>
            </>
          )}
          <a className="btn" href={THERMAL.discordBotUrl} target="_blank" rel="noreferrer">
            {THERMAL.discordBotCta}
          </a>
          <Link className="btn" to="/app/dashboard">
            Mission Control
          </Link>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <p>Cutline Industries · Thermal on cutline-industries.studio</p>
        <p>
          <a href="mailto:lpittman@cutline-industries.studio">lpittman@cutline-industries.studio</a>
        </p>
      </footer>
    </div>
  )
}
