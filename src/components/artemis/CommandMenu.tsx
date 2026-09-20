import { useEffect, useId } from 'react'

export type CommandItem = {
  id: string
  label: string
  hint: string
}

export function CommandMenu({
  open,
  items,
  onToggle,
  onClose,
  onSelect,
}: {
  open: boolean
  items: readonly CommandItem[]
  onToggle: () => void
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const drawerId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className="artemis-command">
      <button
        type="button"
        className="artemis-command-toggle"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={onToggle}
      >
        <span className="artemis-command-dot" aria-hidden="true" />
        Command Menu
        <svg className="artemis-command-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>

      <div
        className={`artemis-command-backdrop${open ? ' open' : ''}`}
        aria-hidden="true"
        onClick={onClose}
      />

      <nav
        id={drawerId}
        role="menu"
        aria-label="Artemis command menu"
        className={`artemis-command-drawer${open ? ' open' : ''}`}
      >
        <p className="artemis-command-kicker">Lunar Gate / Command</p>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" role="menuitem" className="artemis-command-link" onClick={() => onSelect(item.id)}>
                {item.label}
                <span>{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
