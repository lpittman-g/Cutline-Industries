import { Link, NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/terminal', label: 'Terminal' },
  { to: '/bounty', label: 'Bounty Board' },
  { to: '/developers', label: 'Developers' },
  { to: '/feedback', label: 'Content input' },
  { to: '/approve', label: 'Agent approve' },
]

export function PublicShell() {
  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand public-brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE INDUSTRIES</strong>
            <span>platform · terminal · ops</span>
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
          <Link className="btn btn-primary" to="/terminal">
            Open terminal
          </Link>
          <Link className="btn" to="/app/dashboard">
            Mission Control
          </Link>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <p>Cutline Industries · cutline-industries.studio</p>
        <p>
          <a href="mailto:lpittman@cutline-industries.studio">lpittman@cutline-industries.studio</a>
        </p>
      </footer>
    </div>
  )
}
