import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CommandMenu, type CommandItem } from './CommandMenu'
import { ArtemisMark } from './ArtemisMark'

const LANDING_ITEMS: CommandItem[] = [
  { id: 'enter', label: 'Enter Artemis', hint: 'Open the console' },
  { id: 'capabilities', label: 'View Capabilities', hint: 'Bow · Orion · Chronicler' },
  { id: 'bow', label: 'The Bow', hint: 'Console engine' },
  { id: 'orion', label: 'Orion', hint: 'Vector store' },
  { id: 'chronicler', label: 'Chronicler', hint: 'Hunt memory' },
]

const CONSOLE_ITEMS: CommandItem[] = [
  { id: 'bow', label: 'The Bow', hint: 'Console engine' },
  { id: 'quiver', label: 'The Quiver', hint: 'Data storage' },
  { id: 'iron', label: 'The Iron Forge', hint: 'Enterprise stack' },
  { id: 'lunar', label: 'Lunar Gate', hint: 'Core settings' },
]

export function ArtemisShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const isConsole = location.pathname.startsWith('/console')

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

  const onSelect = (id: string) => {
    closeMenu()
    if (!isConsole) {
      if (id === 'enter' || id === 'bow' || id === 'chronicler') {
        navigate('/console?view=chat')
        return
      }
      if (id === 'orion') {
        navigate('/console?view=files&engine=orion')
        return
      }
      if (id === 'capabilities') {
        document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }
    if (id === 'bow') navigate('/console?view=chat')
    else if (id === 'quiver') navigate('/console?view=files&engine=orion')
    else if (id === 'iron') navigate('/console?view=files&engine=iron')
    else if (id === 'lunar') navigate('/console?view=logs&panel=lunar')
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
          items={isConsole ? CONSOLE_ITEMS : LANDING_ITEMS}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={closeMenu}
          onSelect={onSelect}
        />
      </header>

      <main className="artemis-main">
        <Outlet />
      </main>
    </div>
  )
}
