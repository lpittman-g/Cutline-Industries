import { MEMORY_ACTIONS, type MemoryItem } from '../../lib/artemis'

export function MemoryActions({
  item,
  onEdit,
  onPin,
  onForget,
  onExport,
}: {
  item: MemoryItem
  onEdit: () => void
  onPin: () => void
  onForget: () => void
  onExport: () => void
}) {
  return (
    <div className="artemis-memory-actions" aria-label="Memory controls">
      <button type="button" className="artemis-chip-btn" onClick={onEdit}>
        {MEMORY_ACTIONS[0]}
      </button>
      <button type="button" className="artemis-chip-btn" onClick={onPin}>
        {item.pinned ? 'Unpin' : MEMORY_ACTIONS[1]}
      </button>
      <button type="button" className="artemis-chip-btn" onClick={onForget}>
        {MEMORY_ACTIONS[2]}
      </button>
      <button type="button" className="artemis-chip-btn" onClick={onExport}>
        {MEMORY_ACTIONS[3]}
      </button>
    </div>
  )
}
