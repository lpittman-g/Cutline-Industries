import { Link, NavLink, Outlet } from 'react-router-dom'
import { THERMAL } from '../data/thermal'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/bounty', label: 'Bounty Board' },
  { to: '/developers', label: 'Developers' },
]

export function PublicShell() {
  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand public-brand">
          <div className="brand-mark thermal-mark">T</div>
          <div className="brand-text">
            <strong>THERMAL</strong>
            <span>heat → shorts → cash</span>
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
          <a className="btn btn-primary public-yt" href={THERMAL.discordBotUrl} target="_blank" rel="noreferrer">
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
        <p>Thermal · stream heat into monetized Shorts</p>
        <p>
          <a href="mailto:lpittman@cutline-industries.studio">lpittman@cutline-industries.studio</a>
        </p>
      </footer>
    </div>
  )
}
