import { NavLink, Outlet } from 'react-router-dom'
import { useCutline } from '../context/CutlineContext'

const NAV = [
  { to: '/command', label: 'Command' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/money-now', label: 'Money Now' },
  { to: '/studio', label: 'Studio' },
  { to: '/autopilot', label: 'Autopilot' },
  { to: '/packs', label: 'Packs' },
  { to: '/outreach', label: 'Outreach' },
  { to: '/ads', label: 'Ads Lab' },
  { to: '/monetize', label: 'Money' },
  { to: '/deals', label: 'Deals' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/media-kit', label: 'Media Kit' },
  { to: '/blog', label: 'Blog' },
  { to: '/export', label: 'Export' },
  { to: '/projects', label: 'Projects' },
  { to: '/playbook', label: 'Playbook' },
]

export function AppShell() {
  const { projectClips, projectPacks, activeProject } = useCutline()
  const ready = projectClips.filter((c) => c.status === 'ready' || c.status === 'exported').length

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CUTLINE</strong>
            <span>creator os</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>{activeProject?.name ?? 'No project'}</strong>
          <p>
            {projectClips.length} clips · {ready} ready · {projectPacks.length} packs
          </p>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
