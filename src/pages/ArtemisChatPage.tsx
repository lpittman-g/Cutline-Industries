import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchConversation, type ConversationSummary } from '../lib/artemisApi'
import { BowChat } from '../components/artemis/BowChat'
import { ConversationSidebar } from '../components/artemis/ConversationSidebar'
import { ArtemisMark } from '../components/artemis/ArtemisMark'

type NavSection = 'chat' | 'activity' | 'code' | 'memory' | 'files' | 'voice' | 'logs'

const NAV_ITEMS: { id: NavSection; icon: string; label: string }[] = [
  { id: 'chat', icon: '✦', label: 'The Bow' },
  { id: 'activity', icon: '◉', label: 'Activity' },
  { id: 'code', icon: '⌥', label: 'Code' },
  { id: 'memory', icon: '◈', label: 'Memory' },
  { id: 'files', icon: '⋔', label: 'Quiver' },
  { id: 'voice', icon: '◎', label: 'Voice Mode' },
  { id: 'logs', icon: '⚙', label: 'Settings' },
]

export function ArtemisChatPage() {
  const [params] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeNav, setActiveNav] = useState<NavSection>('chat')
  const [convRefreshKey, setConvRefreshKey] = useState(0)
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined)
  const [loadedMessages, setLoadedMessages] = useState<
    { role: 'operator' | 'artemis'; content: string }[] | undefined
  >(undefined)
  const [sessionKey, setSessionKey] = useState('live')
  const voiceMode = activeNav === 'voice'
  const hunt = params.get('fresh') === 'hunt'

  const startNewChat = () => {
    setActiveConvId(undefined)
    setLoadedMessages(undefined)
    setSessionKey(String(Date.now()))
    setActiveNav('chat')
  }

  const loadConversation = (conv: ConversationSummary) => {
    void fetchConversation(conv.id)
      .then((r) => {
        setActiveConvId(r.conversation.id)
        setLoadedMessages(
          r.conversation.messages.map((m) => ({ role: m.role, content: m.content })),
        )
        setActiveNav('chat')
      })
      .catch(() => undefined)
  }

  return (
    <div className={`achat-root${sidebarOpen ? ' sidebar-open' : ''}`}>
      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="achat-sidebar" aria-label="Artemis navigation">
        <div className="achat-sidebar-head">
          <Link to="/" className="achat-brand">
            <ArtemisMark size={28} />
            <span>Artemis</span>
          </Link>
          <button
            type="button"
            className="achat-collapse-btn"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ‹
          </button>
        </div>

        <nav className="achat-nav" aria-label="Workspace sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`achat-nav-item${activeNav === item.id ? ' is-active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              <span className="achat-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="achat-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="achat-conv-section">
          <p className="achat-conv-heading">Recent</p>
          <ConversationSidebar
            activeId={activeConvId}
            refreshKey={convRefreshKey}
            onNewChat={startNewChat}
            onSelectConversation={loadConversation}
          />
        </div>

        <div className="achat-sidebar-footer">
          <button type="button" className="achat-new-chat-btn" onClick={startNewChat}>
            <span aria-hidden="true">✦</span> New Chat
          </button>
        </div>
      </aside>

      {/* ── Sidebar toggle (collapsed state) ───── */}
      {!sidebarOpen && (
        <button
          type="button"
          className="achat-open-btn"
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          ›
        </button>
      )}

      {/* ── Main chat area ───────────────────────── */}
      <main className="achat-main">
        {activeNav === 'chat' || activeNav === 'voice' ? (
          <BowChat
            key={activeConvId ?? sessionKey}
            hunt={hunt}
            voiceMode={voiceMode}
            initialMessages={loadedMessages}
            initialConversationId={activeConvId}
            onConversationSaved={(id) => {
              setActiveConvId(id)
              setConvRefreshKey((k) => k + 1)
            }}
            onOpenChronicle={() => setActiveNav('memory')}
          />
        ) : activeNav === 'activity' ? (
          <div className="achat-placeholder">
            <span aria-hidden="true">◉</span>
            <p>Activity — tool steps, generation events, and processing logs for your active conversation appear here during a hunt.</p>
            <Link to="/console?view=chat" className="artemis-cta-secondary artemis-cta-compact">
              Open Full Console
            </Link>
          </div>
        ) : activeNav === 'code' ? (
          <div className="achat-placeholder">
            <span aria-hidden="true">⌥</span>
            <p>Code — run Python, Node.js, or Bash from the full console sandbox.</p>
            <Link to="/console?view=chat&panel=sandbox" className="artemis-cta-secondary artemis-cta-compact">
              Open Sandbox
            </Link>
          </div>
        ) : activeNav === 'memory' ? (
          <div className="achat-placeholder">
            <span aria-hidden="true">◈</span>
            <p>Memory — open the full console for your knowledge board.</p>
            <Link to="/console?view=memory" className="artemis-cta-secondary artemis-cta-compact">
              Open Memory
            </Link>
          </div>
        ) : activeNav === 'files' ? (
          <div className="achat-placeholder">
            <span aria-hidden="true">⋔</span>
            <p>Quiver — upload and index files from the full console.</p>
            <Link to="/console?view=files" className="artemis-cta-secondary artemis-cta-compact">
              Open Quiver
            </Link>
          </div>
        ) : (
          <div className="achat-placeholder">
            <span aria-hidden="true">⚙</span>
            <p>Settings — manage your account and workspace.</p>
            <Link to="/console?view=logs&panel=lunar" className="artemis-cta-secondary artemis-cta-compact">
              Open Settings
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
