import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { COMMAND_MENU_ITEMS, commandMenuPath, type CommandMenuId } from '../../lib/artemis'
import { CommandMenu } from './CommandMenu'
import { ArtemisMark } from './ArtemisMark'

const ACTION_STUBS = [
  { id: 'index', label: 'Index latest uploads', hint: 'Open Quiver and run extract → chunk → index' },
  { id: 'brief', label: 'Generate hunt brief', hint: 'Start a New Hunt in The Bow' },
  { id: 'chronicle', label: 'Summarize Chronicle', hint: 'Open memory research notes' },
] as const

export function ArtemisShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('artemis-canvas')
    document.title = 'Artemis — Cutline Industries'
    return () => {
      root.classList.remove('artemis-canvas')
      document.title = 'Cutline Industries'
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMenuOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = (id: CommandMenuId) => {
    closeMenu()
    if (id === 'action') {
      setActionOpen(true)
      return
    }
    const path = commandMenuPath(id, String(Date.now()))
    if (path) navigate(path)
  }

  const runStub = (id: (typeof ACTION_STUBS)[number]['id']) => {
    setActionOpen(false)
    if (id === 'index') navigate(commandMenuPath('upload', String(Date.now())) || '/console?view=files')
    else if (id === 'brief') navigate(commandMenuPath('new-hunt', String(Date.now())) || '/console?view=chat')
    else navigate(commandMenuPath('research') || '/console?view=memory&section=research')
  }

  return (
    <div className="artemis-shell">
      <div className="artemis-ambient" aria-hidden="true">
        <span className="artemis-glow artemis-glow-a" />
        <span className="artemis-glow artemis-glow-b" />
        <span className="artemis-grid" />
        <span className="artemis-particles" />
      </div>

      <header className="artemis-topbar">
        <Link to="/" className="artemis-brand">
          <ArtemisMark size={34} />
          <span>Artemis</span>
        </Link>
        <CommandMenu
          open={menuOpen}
          items={COMMAND_MENU_ITEMS}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={closeMenu}
          onSelect={(id) => go(id as CommandMenuId)}
        />
      </header>

      <main className="artemis-main">
        <Outlet />
      </main>

      {actionOpen && (
        <div className="artemis-modal-backdrop" onClick={() => setActionOpen(false)}>
          <div
            className="artemis-modal"
            role="dialog"
            aria-labelledby="artemis-run-action-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="artemis-command-kicker">Command</p>
            <h2 id="artemis-run-action-title">Run Action</h2>
            <p>Scaffold workflows. Each action opens the matching console surface.</p>
            <ul className="artemis-action-list">
              {ACTION_STUBS.map((item) => (
                <li key={item.id}>
                  <button type="button" className="artemis-command-link" onClick={() => runStub(item.id)}>
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={() => setActionOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
