import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  editMemory,
  exportMemory,
  fetchMemoryBoard,
  forgetMemory,
  memorySectionLabel,
  pinMemory,
} from '../../lib/artemisApi'
import {
  MEMORY_SECTIONS,
  MEMORY_SOURCES,
  parseMemorySection,
  type MemoryItem,
  type MemoryKind,
  type MemorySection,
} from '../../lib/artemis'
import { MemoryActions } from './MemoryActions'

function downloadExport(kind: MemoryKind, id: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${kind}-${id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function MemoryItemBlock({
  kind,
  item,
  editing,
  setEditing,
  onAction,
}: {
  kind: MemoryKind
  item: MemoryItem
  editing: { kind: MemoryKind; id: string; title: string; body: string } | null
  setEditing: (next: { kind: MemoryKind; id: string; title: string; body: string } | null) => void
  onAction: (fn: () => Promise<unknown>, ok: string) => Promise<void>
}) {
  if (editing?.id === item.id && editing.kind === kind) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void onAction(
            () => editMemory(kind, item.id, { title: editing.title, body: editing.body }),
            'Saved.',
          ).then(() => setEditing(null))
        }}
      >
        <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
        <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={6} />
        <div className="artemis-memory-actions">
          <button type="submit" className="artemis-chip-btn">
            Save
          </button>
          <button type="button" className="artemis-chip-btn" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <>
      <strong>
        {item.pinned ? '📌 ' : ''}
        {item.title}
      </strong>
      {item.path && <small className="artemis-memory-path">{item.path}</small>}
      <p>{item.body}</p>
      <MemoryActions
        item={item}
        onEdit={() => setEditing({ kind, id: item.id, title: item.title, body: item.body })}
        onPin={() => void onAction(() => pinMemory(kind, item.id, !item.pinned), item.pinned ? 'Unpinned.' : 'Pinned.')}
        onForget={() => void onAction(() => forgetMemory(kind, item.id), 'Forgotten.')}
        onExport={() =>
          void exportMemory(kind, item.id).then((data) => {
            downloadExport(kind, item.id, data)
          })
        }
      />
    </>
  )
}

export function MemoryBoard() {
  const [params, setParams] = useSearchParams()
  const section = parseMemorySection(params.get('section'))
  const [board, setBoard] = useState<Record<MemoryKind, MemoryItem[]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ kind: MemoryKind; id: string; title: string; body: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const setSection = (kind: MemorySection) => {
    const next = new URLSearchParams(params)
    next.set('view', 'memory')
    next.set('section', kind)
    setParams(next, { replace: true })
    setEditing(null)
    setNotice(null)
  }

  const reload = () =>
    fetchMemoryBoard()
      .then((r) => {
        setBoard({ ...r.board, notes: r.board.notes ?? [] })
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Memory unavailable'))

  useEffect(() => {
    void reload()
  }, [])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      setNotice(ok)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  if (!board) {
    return <p className="artemis-empty">{error || 'Loading Chronicle…'}</p>
  }

  const items = board[section]
  const notes = board.notes ?? []

  return (
    <div className="artemis-memory">
      <div>
        <h2>Chronicle</h2>
        <p>Everything Artemis knows — Edit · Pin · Forget · Export. Nothing is opaque.</p>
      </div>
      {error && <p className="artemis-error">{error}</p>}
      {notice && <p className="artemis-banner">{notice}</p>}
      {notes.length > 0 && (
        <section className="artemis-memory-notes" aria-label="Notes from memory.json">
          <div className="artemis-memory-detail-head">
            <h3>Notes</h3>
            <p className="artemis-empty">Stored in artemis-data/{MEMORY_SOURCES.notes}</p>
          </div>
          <ul>
            {notes.map((item) => (
              <li key={item.id} className={item.pinned ? 'is-pinned' : undefined}>
                <MemoryItemBlock
                  kind="notes"
                  item={item}
                  editing={editing}
                  setEditing={setEditing}
                  onAction={run}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="artemis-memory-layout">
        <nav className="artemis-memory-nav" aria-label="Memory sections">
          {MEMORY_SECTIONS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={kind === section ? 'is-active' : undefined}
              aria-current={kind === section ? 'page' : undefined}
              onClick={() => setSection(kind)}
            >
              <span>{memorySectionLabel(kind)}</span>
              <em>{board[kind].length}</em>
            </button>
          ))}
        </nav>
        <section className="artemis-memory-detail">
          <div className="artemis-memory-detail-head">
            <h3>{memorySectionLabel(section)}</h3>
            <p className="artemis-empty">Stored in artemis-data/{MEMORY_SOURCES[section]}</p>
          </div>
          {items.length === 0 ? (
            <p className="artemis-empty">No {section} yet.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.pinned ? 'is-pinned' : undefined}>
                  <MemoryItemBlock
                    kind={section}
                    item={item}
                    editing={editing}
                    setEditing={setEditing}
                    onAction={run}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
