import { useEffect, useRef, useState } from 'react'
import { attachArtemisFile, fetchChronicle, speakArtemis, streamArtemisChat } from '../../lib/artemisApi'
import {
  DEFAULT_VOICE,
  PROCESS_STEPS,
  VOICES,
  isVoiceId,
  type ChatMessage,
  type ChronicleCheck,
  type ProcessStepId,
  type StepStatus,
  type VoiceId,
} from '../../lib/artemis'
import { ProcessingStepper } from './ProcessingStepper'

function idleSteps(): Record<ProcessStepId, StepStatus> {
  return Object.fromEntries(PROCESS_STEPS.map((s) => [s.id, 'pending'])) as Record<ProcessStepId, StepStatus>
}

export function BowChat({ onOpenChronicle }: { onOpenChronicle: () => void }) {
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE)
  const [message, setMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'artemis', content: 'Welcome to The Bow. Ask Artemis anything — memory and voice are on.' },
  ])
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState(idleSteps)
  const [showSteps, setShowSteps] = useState(false)
  const [checks, setChecks] = useState<ChronicleCheck[]>([])
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchChronicle()
      .then((r) => setChecks(r.checks))
      .catch(() => setChecks([]))
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, showSteps])

  const send = async () => {
    const text = message.trim()
    if (!text || busy) return
    setMessage('')
    setBusy(true)
    setShowSteps(true)
    setSteps(idleSteps())
    setMessages((m) => [...m, { role: 'operator', content: text }, { role: 'artemis', content: '' }])
    try {
      await streamArtemisChat({ message: text, conversationId, voice }, (event) => {
        if (event.type === 'meta') setConversationId(event.conversationId)
        if (event.type === 'step') {
          setSteps((prev) => ({
            ...prev,
            [event.id]: event.status === 'done' ? 'done' : 'in_progress',
          }))
        }
        if (event.type === 'chunk') {
          setMessages((m) => {
            const next = [...m]
            const last = next[next.length - 1]
            if (last?.role === 'artemis') next[next.length - 1] = { ...last, content: last.content + event.text }
            return next
          })
        }
        if (event.type === 'done') setConversationId(event.conversationId)
      })
      void fetchChronicle()
        .then((r) => setChecks(r.checks))
        .catch(() => undefined)
    } catch (err) {
      const fail = err instanceof Error ? err.message : 'Chat failed'
      setMessages((m) => {
        const next = [...m]
        const last = next[next.length - 1]
        if (last?.role === 'artemis') next[next.length - 1] = { ...last, content: fail }
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  const speakLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'artemis' && m.content.trim())
    if (!last) return
    try {
      const result = await speakArtemis(last.content, voice)
      if (result.audioBase64) {
        const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`)
        void audio.play()
        setVoiceNote(null)
      } else {
        setVoiceNote(result.message || `${VOICES[voice].label} voice stub ready.`)
      }
    } catch (err) {
      setVoiceNote(err instanceof Error ? err.message : 'Voice failed')
    }
  }

  const onAttach = async (files: FileList | null) => {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      try {
        await attachArtemisFile(file.name)
        setMessages((m) => [...m, { role: 'artemis', content: `Attached ${file.name} to Chronicle files.` }])
      } catch (err) {
        setMessages((m) => [
          ...m,
          { role: 'artemis', content: err instanceof Error ? err.message : 'Attach failed' },
        ])
      }
    }
    void fetchChronicle()
      .then((r) => setChecks(r.checks))
      .catch(() => undefined)
  }

  return (
    <div className="artemis-bow artemis-bow-chat">
      <aside className="artemis-chronicler">
        <div className="artemis-chronicler-head">
          <span>Chronicler</span>
        </div>
        <p className="artemis-empty">Recent knowledge</p>
        <ul className="artemis-chronicle-list">
          {checks.length === 0 ? (
            <li className="artemis-empty">No Chronicle entries yet.</li>
          ) : (
            checks.map((check) => (
              <li key={check.id}>
                <span aria-hidden="true">{check.done ? '✓' : '○'}</span>
                {check.label}
              </li>
            ))
          )}
        </ul>
        <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={onOpenChronicle}>
          View Chronicle →
        </button>
      </aside>

      <div className="artemis-bow-main">
        <div className="artemis-chat-head">
          <div>
            <h2>The Bow</h2>
            <p>
              {VOICES[voice].label} • Voice enabled • Memory enabled
            </p>
          </div>
          <label className="artemis-voice-select">
            Voice
            <select
              value={voice}
              aria-label="Artemis voice"
              onChange={(e) => setVoice(isVoiceId(e.target.value) ? e.target.value : DEFAULT_VOICE)}
            >
              {Object.values(VOICES).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="artemis-chat-log" ref={listRef}>
          {messages.map((msg, i) => (
            <article key={`${msg.role}-${i}`} className={`artemis-bubble is-${msg.role}`}>
              <span>{msg.role === 'operator' ? 'You' : 'Artemis'}</span>
              <p>{msg.content || (busy ? '…' : '')}</p>
            </article>
          ))}
          {showSteps && <ProcessingStepper statuses={steps} />}
        </div>

        {voiceNote && <p className="artemis-banner">{voiceNote}</p>}

        <form
          className="artemis-composer"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <input
            ref={attachRef}
            type="file"
            hidden
            multiple
            onChange={(e) => void onAttach(e.target.files)}
          />
          <button type="button" className="artemis-icon-btn" aria-label="Attach file" onClick={() => attachRef.current?.click()}>
            +
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask Artemis anything..."
            aria-label="Ask Artemis anything"
            disabled={busy}
          />
          <button type="button" className="artemis-chip-btn" onClick={() => void speakLast()}>
            Speak
          </button>
          <button type="submit" className="artemis-cta-primary artemis-cta-compact" disabled={busy || !message.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
