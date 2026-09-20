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

function idleSteps(): Record<ProcessStepId, StepStatus> {
  return Object.fromEntries(PROCESS_STEPS.map((s) => [s.id, 'pending'])) as Record<ProcessStepId, StepStatus>
}

function uploadSteps(files: 'pending' | 'in_progress' | 'done' = 'in_progress'): Record<ProcessStepId, StepStatus> {
  return {
    understand: 'done',
    chronicle: 'done',
    project: 'done',
    files,
    generate: files === 'done' ? 'done' : 'pending',
    learn: files === 'done' ? 'done' : 'pending',
  }
}

export function BowChat({
  onOpenChronicle,
  knowledgeId,
}: {
  onOpenChronicle: (section?: MemoryKind) => void
  knowledgeId?: string
}) {
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE)
  const [message, setMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'artemis', content: 'Welcome to The Bow. Ask Artemis anything — memory and voice are on.' },
  ])
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

  const send = async () => {
    const text = message.trim()
    if (!text || busy) return
    setMessage('')
    setBusy(true)
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
      { role: 'artemis', content: '', steps: uploadSteps('in_progress') },
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
      setMessages((m) => {
        const next = [...m]
        const last = next[next.length - 1]
        if (last?.role === 'artemis') {
          next[next.length - 1] = {
            ...last,
            content: `Processing files complete.\n${summaries.join('\n')}`,
            steps: uploadSteps('done'),
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
    setMessage(askAboutFilePrompt(card.filename))
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
              {msg.content ? <p>{msg.content}</p> : null}
              {msg.cards?.map((card) => (
                <KnowledgeFileCard key={card.id} card={card} onAsk={askAbout} />
              ))}
              {msg.steps && <ProcessingStepper statuses={msg.steps} />}
            </article>
          ))}
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
          <button type="submit" className="artemis-cta-primary artemis-cta-compact" disabled={busy || !message.trim()}>
            Send
          </button>
        </form>
        <p className="artemis-upload-hint">{UPLOAD_LABELS.join(' · ')}</p>
      </div>
    </div>
  )
}
