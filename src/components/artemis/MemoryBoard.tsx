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
} from '../../lib/artemis'

export function MemoryBoard() {
  const [params, setParams] = useSearchParams()
  const section = parseMemorySection(params.get('section'))
  const [board, setBoard] = useState<Record<MemoryKind, MemoryItem[]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ kind: MemoryKind; id: string; title: string; body: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const setSection = (kind: MemoryKind) => {
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
        setBoard(r.board)
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

  return (
    <div className="artemis-memory">
      <div>
        <h2>Chronicle</h2>
        <p>Everything Artemis knows — edit, pin, forget, or export any item. Nothing is opaque.</p>
      </div>
      {error && <p className="artemis-error">{error}</p>}
      {notice && <p className="artemis-banner">{notice}</p>}
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
                  {editing?.id === item.id && editing.kind === section ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void run(
                          () => editMemory(section, item.id, { title: editing.title, body: editing.body }),
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
                  ) : (
                    <>
                      <strong>
                        {item.pinned ? '📌 ' : ''}
                        {item.title}
                      </strong>
                      {item.path && <small className="artemis-memory-path">{item.path}</small>}
                      <p>{item.body}</p>
                      <div className="artemis-memory-actions">
                        <button
                          type="button"
                          className="artemis-chip-btn"
                          onClick={() => setEditing({ kind: section, id: item.id, title: item.title, body: item.body })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="artemis-chip-btn"
                          onClick={() => void run(() => pinMemory(section, item.id), 'Pinned.')}
                        >
                          Pin
                        </button>
                        <button
                          type="button"
                          className="artemis-chip-btn"
                          onClick={() => void run(() => forgetMemory(section, item.id), 'Forgotten.')}
                        >
                          Forget
                        </button>
                        <button
                          type="button"
                          className="artemis-chip-btn"
                          onClick={() =>
                            void exportMemory(section, item.id).then((data) => {
                              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${section}-${item.id}.json`
                              a.click()
                              URL.revokeObjectURL(url)
                              setNotice('Exported.')
                            })
                          }
                        >
                          Export
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
