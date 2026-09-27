import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  commandMenuShortcutLabel,
  filterCommandItems,
  isCommandMenuHotkey,
} from '../../lib/artemis'

export type CommandItem = {
  id: string
  icon?: string
  label: string
  hint: string
}

export function CommandMenu({
  open,
  items,
  onOpen,
  onToggle,
  onClose,
  onSelect,
}: {
  open: boolean
  items: readonly CommandItem[]
  onOpen: () => void
  onToggle: () => void
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const drawerId = useId()
  const searchId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const shortcut = commandMenuShortcutLabel()
  const visible = useMemo(() => filterCommandItems(items, query), [items, query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCommandMenuHotkey(e)) return
      e.preventDefault()
      if (open) {
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      onOpen()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onOpen])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      window.cancelAnimationFrame(frame)
    }
  }, [open, onClose])

  const submitFilter = (e: FormEvent) => {
    e.preventDefault()
    const first = visible[0]
    if (first) onSelect(first.id)
  }

  return (
    <div className="artemis-command">
      <button
        type="button"
        className="artemis-command-toggle"
        aria-expanded={open}
        aria-controls={drawerId}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={onToggle}
      >
        <span className="artemis-command-dot" aria-hidden="true" />
        Command Menu
        <kbd className="artemis-command-kbd">{shortcut}</kbd>
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
        <form className="artemis-command-search" onSubmit={submitFilter}>
          <label className="visually-hidden" htmlFor={searchId}>
            Filter commands
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            placeholder="Search commands…"
            autoComplete="off"
            aria-label="Filter commands"
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <ul>
          {visible.length === 0 ? (
            <li className="artemis-command-empty">No matching commands</li>
          ) : (
            visible.map((item) => (
              <li key={item.id}>
                <button type="button" role="menuitem" className="artemis-command-link" onClick={() => onSelect(item.id)}>
                  <strong>
                    {item.icon ? <em aria-hidden="true">{item.icon}</em> : null}
                    {item.label}
                  </strong>
                  <span>{item.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </nav>
    </div>
  )
}
