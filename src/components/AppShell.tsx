import { Link, NavLink, Outlet } from 'react-router-dom'
import { useCutline } from '../context/cutlineContextObject'

const NAV = [
  { to: '/os/command', label: 'Command' },
  { to: '/os/blueprint', label: 'Blueprint' },
  { to: '/os/sprint-73', label: '73h Sprint' },
  { to: '/os/pipeline', label: 'Pipeline' },
  { to: '/os/money-now', label: 'Money Now' },
  { to: '/os/studio', label: 'Studio' },
  { to: '/os/autopilot', label: 'Autopilot' },
  { to: '/os/packs', label: 'Packs' },
  { to: '/os/outreach', label: 'Outreach' },
  { to: '/os/ads', label: 'Ads Lab' },
  { to: '/os/monetize', label: 'Money' },
  { to: '/os/deals', label: 'Deals' },
  { to: '/os/analytics', label: 'Analytics' },
  { to: '/os/media-kit', label: 'Media Kit' },
  { to: '/os/blog', label: 'Blog' },
  { to: '/os/export', label: 'Export' },
  { to: '/os/projects', label: 'Projects' },
  { to: '/os/playbook', label: 'Playbook' },
]

export function AppShell() {
  const { projectClips, projectPacks, activeProject } = useCutline()
  const ready = projectClips.filter((c) => c.status === 'ready' || c.status === 'exported').length

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/os/command" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>internal os</span>
          </div>
        </Link>
        <p className="os-badge">Internal tools — not the public site</p>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>{activeProject?.name ?? 'No project'}</strong>
          <p>
            {projectClips.length} clips · {ready} ready · {projectPacks.length} packs
          </p>
          <Link to="/" style={{ color: 'var(--cyan)', fontSize: '0.8rem' }}>
            ← Public site
          </Link>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
