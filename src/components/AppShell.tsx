import { NavLink, Outlet } from 'react-router-dom'
import { useCutline } from '../context/CutlineContext'

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
            <span>industries</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/studio" className={({ isActive }) => (isActive ? 'active' : '')}>
            Studio
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => (isActive ? 'active' : '')}>
            Projects
          </NavLink>
          <NavLink to="/packs" className={({ isActive }) => (isActive ? 'active' : '')}>
            Packs
          </NavLink>
          <NavLink to="/export" className={({ isActive }) => (isActive ? 'active' : '')}>
            Export
          </NavLink>
          <NavLink to="/autopilot" className={({ isActive }) => (isActive ? 'active' : '')}>
            Autopilot
          </NavLink>
          <NavLink to="/playbook" className={({ isActive }) => (isActive ? 'active' : '')}>
            Playbook
          </NavLink>
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
