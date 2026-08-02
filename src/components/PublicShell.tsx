import { Link, NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/work', label: 'Work' },
  { to: '/media-kit', label: 'Media Kit' },
  { to: '/blog', label: 'Blog' },
  { to: '/deals', label: 'Contact' },
]

export function PublicShell() {
  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand public-brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>industries</span>
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
          <a
            className="btn btn-primary public-yt"
            href="https://www.youtube.com/@lamontpittman-f4q"
            target="_blank"
            rel="noreferrer"
          >
            YouTube
          </a>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <p>Cutline Industries · gaming media studio</p>
        <p>
          <a href="mailto:lpittman@cutline-industries.studio">lpittman@cutline-industries.studio</a>
        </p>
      </footer>
    </div>
  )
}
