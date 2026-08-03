import { Link, NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/streams', label: 'Streams' },
  { to: '/app/clips', label: 'Clips' },
  { to: '/app/bounty', label: 'Bounty Board' },
  { to: '/app/developers', label: 'Developers' },
  { to: '/app/revenue', label: 'Revenue' },
]

export function MissionShell() {
  return (
    <div className="app-shell mission-shell">
      <aside className="sidebar">
        <Link to="/app/dashboard" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark thermal-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>Thermal mission control</span>
          </div>
        </Link>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p style={{ margin: '0 0 0.5rem' }}>Cutline queue powers clip render</p>
          <Link to="/" style={{ color: 'var(--cyan)', fontSize: '0.8rem' }}>
            ← Public site
          </Link>
          <br />
          <Link to="/os" style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
            Cutline tools
          </Link>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
