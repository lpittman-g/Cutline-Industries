import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { COMMAND_MENU_ITEMS, commandMenuPath, driveConsolePath, type CommandMenuId } from '../../lib/artemis'
import { fetchAuthUser, logout, type AuthUser } from '../../lib/authApi'
import { CommandMenu } from './CommandMenu'
import { ArtemisMark } from './ArtemisMark'
import { MfaModal } from './MfaModal'

const ACTION_STUBS = [
  { id: 'drive', label: 'Import from Google Drive', hint: 'Select a file → extract · chunk · index' },
  { id: 'index', label: 'Index latest uploads', hint: 'Open Quiver and run extract → chunk → index' },
  { id: 'brief', label: 'Generate hunt brief', hint: 'Start a New Hunt in The Bow' },
  { id: 'chronicle', label: 'Summarize Chronicle', hint: 'Open memory research notes' },
] as const

export function ArtemisShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [mfaOpen, setMfaOpen] = useState(false)
  const [userDropOpen, setUserDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchAuthUser().then((r) => setUser(r.user)).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    if (!userDropOpen) return
    const close = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setUserDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [userDropOpen])

  const handleSignOut = async () => {
    setUserDropOpen(false)
    try { await logout() } catch { /* ignore */ }
    setUser(null)
    navigate('/signin')
  }

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
  const openMenu = useCallback(() => {
    setActionOpen(false)
    setMenuOpen(true)
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
    if (id === 'drive') navigate(driveConsolePath())
    else if (id === 'index') navigate(commandMenuPath('upload', String(Date.now())) || '/console?view=files')
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
          <span>Artemis AI</span>
        </Link>
        <nav className="artemis-topbar-nav" aria-label="Account">
          <Link to="/artemisChat" className="artemis-topbar-cta-dark">Get started</Link>
          <CommandMenu
            open={menuOpen}
            items={COMMAND_MENU_ITEMS}
            onOpen={openMenu}
            onToggle={() => setMenuOpen((v) => !v)}
            onClose={closeMenu}
            onSelect={(id) => go(id as CommandMenuId)}
            label="Menu"
          />
          {user ? (
            <div ref={dropRef} className="artemis-user-menu" style={{ position: 'relative' }}>
              <button
                type="button"
                className="artemis-topbar-link artemis-user-btn"
                onClick={() => setUserDropOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={userDropOpen}
              >
                <span className="artemis-status-dot" aria-hidden="true" style={{ background: '#4ade80' }} />
                {user.displayName || user.email}
                <span aria-hidden="true" style={{ opacity: 0.5, fontSize: '0.7em', marginLeft: '0.2em' }}>▾</span>
              </button>
              {userDropOpen && (
                <div className="artemis-user-dropdown" role="menu">
                  <div className="artemis-user-dropdown-header">
                    <span>{user.email}</span>
                    {user.role && <span className="artemis-badge" style={{ padding: '0.1em 0.5em', fontSize: '0.7rem' }}>{user.role}</span>}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="artemis-command-link"
                    onClick={() => { setUserDropOpen(false); setMfaOpen(true) }}
                  >
                    <strong>Two-Factor Auth</strong>
                    <span>{user.mfaEnabled ? 'Enabled — manage' : 'Not enabled — set up'}</span>
                  </button>
                  <div className="artemis-user-dropdown-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="artemis-command-link"
                    onClick={() => void handleSignOut()}
                  >
                    <strong>Sign Out</strong>
                  </button>
                </div>
              )}
            </div>
          ) : user === null ? (
            <Link to="/signin" className="artemis-topbar-link">Sign In</Link>
          ) : null}
        </nav>
      </header>

      <main className="artemis-main">
        <Outlet />
      </main>

      {mfaOpen && user && (
        <MfaModal
          mfaEnabled={user.mfaEnabled}
          onClose={() => setMfaOpen(false)}
          onChanged={(enabled) => setUser((u) => u ? { ...u, mfaEnabled: enabled } : u)}
        />
      )}

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
