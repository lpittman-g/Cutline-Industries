import { useEffect, useState } from 'react'
import { fetchConversations, type ConversationSummary } from '../../lib/artemisApi'

function relativeLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  if (date >= todayStart) return 'Today'
  if (date >= yesterdayStart) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ConversationSidebar({
  activeId,
  refreshKey,
  onNewChat,
  onSelectConversation,
}: {
  activeId?: string
  refreshKey: number
  onNewChat: () => void
  onSelectConversation: (conv: ConversationSummary) => void
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])

  useEffect(() => {
    void fetchConversations()
      .then((r) => setConversations(r.conversations))
      .catch(() => setConversations([]))
  }, [refreshKey])

  return (
    <nav className="artemis-conv-sidebar" aria-label="Conversation history">
      <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={onNewChat}>
        + New Chat
      </button>
      <ul>
        {conversations.length === 0 ? (
          <li className="artemis-empty">No past conversations.</li>
        ) : (
          conversations.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                className={`artemis-conv-item${conv.id === activeId ? ' is-active' : ''}`}
                onClick={() => onSelectConversation(conv)}
              >
                <span className="artemis-conv-title">{conv.title}</span>
                <span className="artemis-conv-time">{relativeLabel(conv.updatedAt)}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </nav>
  )
}
