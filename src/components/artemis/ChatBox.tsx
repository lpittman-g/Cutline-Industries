import { useState, useTransition, useRef, useEffect } from 'react'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = 'You are Artemis, a precise conversational AI built by Cutline Industries.'

export function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: SYSTEM_PROMPT },
  ])
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isPending) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const updatedHistory = [...messages, userMessage]

    setMessages(updatedHistory)
    setInput('')

    startTransition(async () => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedHistory }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply ?? '(no reply)' },
        ])
      } catch (err) {
        console.error('[ChatBox] fetch error:', err)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '⚠ Connection interrupted. Try again.' },
        ])
      }
    })
  }

  const visible = messages.filter((m) => m.role !== 'system')

  return (
    <div className="artemis-chatbox">
      <div className="artemis-chatbox-log">
        {visible.length === 0 && (
          <p className="artemis-empty">Ask Artemis anything — powered by your self-hosted model.</p>
        )}
        {visible.map((msg, idx) => (
          <div
            key={idx}
            className={`artemis-chatbox-bubble is-${msg.role === 'user' ? 'operator' : 'artemis'}`}
          >
            <span className="artemis-chatbox-label">
              {msg.role === 'user' ? 'You' : 'Artemis'}
            </span>
            <p>{msg.content}</p>
          </div>
        ))}
        {isPending && (
          <div className="artemis-chatbox-bubble is-artemis">
            <span className="artemis-chatbox-label">Artemis</span>
            <p className="artemis-thinking">Thinking…</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form className="artemis-composer" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Artemis anything…"
          aria-label="Quick chat input"
          disabled={isPending}
        />
        <button
          type="submit"
          className="artemis-cta-primary artemis-cta-compact"
          disabled={isPending || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}
