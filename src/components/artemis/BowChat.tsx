import { useEffect, useRef, useState } from 'react'
import { fetchChronicle, fetchKnowledgeFile, speakArtemis, streamArtemisChat, touchKnowledgeFile, uploadArtemisFile } from '../../lib/artemisApi'
import {
  DEFAULT_VOICE,
  PROCESS_STEPS,
  UPLOAD_ACCEPT,
  UPLOAD_LABELS,
  VOICES,
  askAboutFilePrompt,
  isAllowedUpload,
  isVoiceId,
  type ChatMessage,
  type ChronicleCheck,
  type KnowledgeCard,
  type MemoryKind,
  type ProcessStepId,
  type StepStatus,
  type VoiceId,
} from '../../lib/artemis'
import { ProcessingStepper } from './ProcessingStepper'
import { KnowledgeFileCard } from './KnowledgeFileCard'
import { uid } from '../../lib/utils'
import { MarkdownMessage } from './MarkdownMessage'
import { ArtemisMark } from './ArtemisMark'

function idleSteps(): Record<ProcessStepId, StepStatus> {
  return Object.fromEntries(PROCESS_STEPS.map((s) => [s.id, 'pending'])) as Record<ProcessStepId, StepStatus>
}

const RAG_STAGE = ['extract', 'chunk', 'index'] as const
type RagStage = (typeof RAG_STAGE)[number] | 'done'

function ragSteps(active: RagStage): Record<ProcessStepId, StepStatus> {
  const steps = idleSteps()
  steps.understand = 'done'
  steps.chronicle = 'done'
  steps.project = 'done'
  for (const id of RAG_STAGE) {
    if (active === 'done') steps[id] = 'done'
    else if (id === active) steps[id] = 'in_progress'
    else if (RAG_STAGE.indexOf(id) < RAG_STAGE.indexOf(active as (typeof RAG_STAGE)[number])) steps[id] = 'done'
    else steps[id] = 'pending'
  }
  if (active === 'done') {
    steps.generate = 'done'
    steps.learn = 'done'
  }
  return steps
}

function pause(ms = 280) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function BowChat({
  onOpenChronicle,
  knowledgeId,
  hunt,
  voiceMode,
  initialMessages,
  initialConversationId,
  onConversationSaved,
}: {
  onOpenChronicle: (section?: MemoryKind) => void
  knowledgeId?: string
  hunt?: boolean
  voiceMode?: boolean
  initialMessages?: { role: 'operator' | 'artemis'; content: string }[]
  initialConversationId?: string
  onConversationSaved?: (id: string) => void
}) {
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE)
  const [message, setMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages && initialMessages.length > 0 ? initialMessages : [],
  )
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<ChronicleCheck[]>([])
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const [uploads, setUploads] = useState<{ id: string; name: string; percent: number; status: string }[]>([])
  const [scopedKnowledge, setScopedKnowledge] = useState<string | undefined>(knowledgeId)
  const attachRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchChronicle()
      .then((r) => setChecks(r.checks))
      .catch(() => setChecks([]))
  }, [])

  useEffect(() => {
    if (!knowledgeId) return
    setScopedKnowledge(knowledgeId)
    void fetchKnowledgeFile(knowledgeId)
      .then((r) => {
        setMessage(askAboutFilePrompt(r.file.filename))
        setMessages((m) => {
          if (m.some((msg) => msg.cards?.some((card) => card.id === r.file.id))) return m
          return [...m, { role: 'artemis', content: `${r.file.filename} is indexed.`, cards: [r.file] }]
        })
        composerRef.current?.focus()
      })
      .catch(() => undefined)
  }, [knowledgeId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (!voiceMode) return
    setVoiceNote(`${VOICES[voice].label} voice mode on. Speak the last reply, or keep typing.`)
    composerRef.current?.focus()
  }, [voiceMode, voice])

  const stop = () => {
    abortRef.current?.abort()
  }

  const retry = () => {
    if (!lastUserMessage) return
    setMessage(lastUserMessage)
    setStopped(false)
  }

  const send = async () => {
    const text = message.trim()
    if (!text || busy) return
    setMessage('')
    setStopped(false)
    setLastUserMessage(text)
    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setMessages((m) => [
      ...m,
      { role: 'operator', content: text },
      { role: 'artemis', content: '', steps: idleSteps() },
    ])
    try {
      await streamArtemisChat({ message: text, conversationId, voice, knowledgeId: scopedKnowledge }, (event) => {
        if (event.type === 'meta') setConversationId(event.conversationId)
        if (event.type === 'step') {
          setMessages((m) => {
            const next = [...m]
            const last = next[next.length - 1]
            if (last?.role === 'artemis') {
              next[next.length - 1] = {
                ...last,
                steps: {
                  ...(last.steps ?? idleSteps()),
                  [event.id]: event.status === 'done' ? 'done' : 'in_progress',
                },
              }
            }
            return next
          })
        }
        if (event.type === 'chunk') {
          setMessages((m) => {
            const next = [...m]
            const last = next[next.length - 1]
            if (last?.role === 'artemis') next[next.length - 1] = { ...last, content: last.content + event.text }
            return next
          })
        }
        if (event.type === 'done') {
          setConversationId(event.conversationId)
          onConversationSaved?.(event.conversationId)
        }
      }, ctrl.signal)
      void fetchChronicle()
        .then((r) => setChecks(r.checks))
        .catch(() => undefined)
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      if (aborted) {
        setStopped(true)
        setMessages((m) => {
          const next = [...m]
          const last = next[next.length - 1]
          if (last?.role === 'artemis' && !last.content) {
            next[next.length - 1] = { ...last, content: '— stopped —' }
          }
          return next
        })
      } else {
        const fail = err instanceof Error ? err.message : 'Chat failed'
        setStopped(true)
        setMessages((m) => {
          const next = [...m]
          const last = next[next.length - 1]
          if (last?.role === 'artemis') next[next.length - 1] = { ...last, content: last.content || fail }
          return next
        })
      }
    } finally {
      abortRef.current = null
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
    if (!files?.length || busy) return
    const list = Array.from(files)
    const blocked = list.filter((file) => !isAllowedUpload(file.name))
    if (blocked.length) {
      setMessages((m) => [
        ...m,
        {
          role: 'artemis',
          content: `Unsupported type: ${blocked.map((f) => f.name).join(', ')}. Use PDF, DOCX, TXT, JSON, CSV, XLSX, images, or code.`,
        },
      ])
      return
    }
    const rows = list.map((file) => ({ id: uid('up'), name: file.name, percent: 0, status: 'Uploading' }))
    setUploads(rows)
    setBusy(true)
    setMessages((m) => [
      ...m,
      { role: 'operator', content: `Upload ${list.map((f) => f.name).join(', ')}` },
      { role: 'artemis', content: '', steps: ragSteps('extract') },
    ])
    const summaries: string[] = []
    const cards: KnowledgeCard[] = []
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        const rowId = rows[i].id
        try {
          const result = await uploadArtemisFile(file, {
            source: 'bow',
            onProgress: (percent) => {
              setUploads((prev) => prev.map((row) => (row.id === rowId ? { ...row, percent, status: `Uploading ${percent}%` } : row)))
            },
          })
          setUploads((prev) =>
            prev.map((row) =>
              row.id === rowId ? { ...row, percent: 100, status: result.stub ? 'Stored (parser stub)' : 'Processed' } : row,
            ),
          )
          if (result.index) {
            cards.push(result.index)
            setScopedKnowledge(result.index.id)
          }
          summaries.push(`${file.name} → ${result.stored.extract}${result.stub ? ' (stub parser)' : ''}`)
        } catch (err) {
          const fail = err instanceof Error ? err.message : 'Upload failed'
          setUploads((prev) => prev.map((row) => (row.id === rowId ? { ...row, status: fail } : row)))
          summaries.push(`${file.name}: ${fail}`)
        }
      }
      const patchSteps = (stage: RagStage) => {
        setMessages((m) => {
          const next = [...m]
          const last = next[next.length - 1]
          if (last?.role === 'artemis') next[next.length - 1] = { ...last, steps: ragSteps(stage) }
          return next
        })
      }
      patchSteps('chunk')
      await pause()
      patchSteps('index')
      await pause()
      setMessages((m) => {
        const next = [...m]
        const last = next[next.length - 1]
        if (last?.role === 'artemis') {
          next[next.length - 1] = {
            ...last,
            content: `Processing files complete.\n${summaries.join('\n')}`,
            steps: ragSteps('done'),
            cards,
          }
        }
        return next
      })
      void fetchChronicle()
        .then((r) => setChecks(r.checks))
        .catch(() => undefined)
    } finally {
      setBusy(false)
      window.setTimeout(() => setUploads([]), 2400)
    }
  }

  const askAbout = (card: KnowledgeCard) => {
    setScopedKnowledge(card.id)
    setMessage(askAboutFilePrompt(card.name || card.filename))
    composerRef.current?.focus()
    void touchKnowledgeFile(card.id).catch(() => undefined)
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
                <button type="button" className="artemis-chronicle-link" onClick={() => onOpenChronicle(check.kind)}>
                  <span aria-hidden="true">{check.done ? '✓' : '○'}</span>
                  {check.label}
                </button>
              </li>
            ))
          )}
        </ul>
        <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={() => onOpenChronicle()}>
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
          <div className="artemis-chat-head-actions">
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
            <button
              type="button"
              className="artemis-chip-btn"
              aria-label="Export conversation"
              title="Export as Markdown"
              onClick={() => {
                const lines = messages
                  .filter((m) => m.content)
                  .map((m) => `**${m.role === 'operator' ? 'You' : 'Artemis'}:** ${m.content}`)
                const md = lines.join('\n\n')
                const blob = new Blob([md], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `artemis-chat-${new Date().toISOString().slice(0, 10)}.md`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export
            </button>
          </div>
        </div>

        <div className="artemis-chat-log" ref={listRef}>
          {messages.length === 0 ? (
            <div className="achat-welcome">
              <div className="achat-welcome-mark">
                <ArtemisMark size={44} />
              </div>
              <h2>{hunt ? 'New hunt ready.' : 'What can Artemis do today?'}</h2>
              <p>Autonomous agents, voice routing, memory search — all from one interface.</p>
              <div className="achat-welcome-chips">
                {[
                  'Start a new hunt',
                  'Summarize my memory',
                  'What can you do?',
                  'Show active agents',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="achat-welcome-chip"
                    onClick={() => setMessage(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <article key={`${msg.role}-${i}`} className={`artemis-bubble is-${msg.role}`}>
                <div className="artemis-bubble-head">
                  <span>{msg.role === 'operator' ? 'You' : 'Artemis'}</span>
                  {msg.content && (
                    <button
                      type="button"
                      className="artemis-copy-btn"
                      aria-label="Copy message"
                      onClick={() => void navigator.clipboard.writeText(msg.content)}
                    >
                      Copy
                    </button>
                  )}
                </div>
                {msg.content ? (
                  msg.role === 'artemis'
                    ? <MarkdownMessage content={msg.content} />
                    : <p>{msg.content}</p>
                ) : (
                  msg.role === 'artemis' && busy && i === messages.length - 1 ? (
                    <div className="achat-typing">
                      <span className="achat-typing-dot" />
                      <span className="achat-typing-dot" />
                      <span className="achat-typing-dot" />
                    </div>
                  ) : null
                )}
                {msg.steps && <ProcessingStepper statuses={msg.steps} />}
                {msg.cards?.map((card) => (
                  <KnowledgeFileCard key={card.id} card={card} onAsk={askAbout} />
                ))}
              </article>
            ))
          )}
        </div>

        {voiceNote && <p className="artemis-banner">{voiceNote}</p>}
        {uploads.length > 0 && (
          <ul className="artemis-upload-list" aria-label="Upload progress">
            {uploads.map((row) => (
              <li key={row.id}>
                <div>
                  <span>{row.name}</span>
                  <em>{row.status}</em>
                </div>
                <div
                  className="artemis-upload-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.percent}
                >
                  <span style={{ width: `${row.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}

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
            accept={UPLOAD_ACCEPT}
            onChange={(e) => {
              void onAttach(e.target.files)
              e.target.value = ''
            }}
          />
          <button type="button" className="artemis-icon-btn" aria-label="Attach file" title={`PDF, DOCX, TXT, JSON, CSV, XLSX, images, code`} onClick={() => attachRef.current?.click()}>
            +
          </button>
          <input
            ref={composerRef}
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
          {busy ? (
            <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={stop}>
              ◼ Stop
            </button>
          ) : stopped && lastUserMessage ? (
            <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={retry}>
              ↺ Retry
            </button>
          ) : (
            <button type="submit" className="artemis-cta-primary artemis-cta-compact" disabled={!message.trim()}>
              Send
            </button>
          )}
        </form>
        <p className="artemis-upload-hint">{UPLOAD_LABELS.join(' · ')}</p>
      </div>
    </div>
  )
}
