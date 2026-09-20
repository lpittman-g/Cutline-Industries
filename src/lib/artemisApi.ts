import {
  DEFAULT_VOICE,
  MEMORY_SECTIONS,
  type ChronicleCheck,
  type ConsoleView,
  type KnowledgeCard,
  type MemoryItem,
  type MemoryKind,
  type VoiceId,
} from './artemis'

const API = import.meta.env.VITE_API_URL || ''

async function parseError(res: Response) {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as { error?: string }
    return parsed.error || text || res.statusText
  } catch {
    return text || res.statusText
  }
}

export async function fetchArtemisVoices() {
  const res = await fetch(`${API}/api/artemis/voices`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; voices: Record<string, { id: VoiceId; label: string }>; activeVoice: VoiceId }>
}

export async function speakArtemis(text: string, voice: VoiceId) {
  const res = await fetch(`${API}/api/artemis/voice`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    ok: boolean
    voice: VoiceId
    stub: boolean
    mimeType: string
    audioBase64: string | null
    message?: string
  }>
}

export async function attachArtemisFile(name: string) {
  const res = await fetch(`${API}/api/artemis/files`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; item: MemoryItem }>
}

export type ArtemisUploadResult = {
  ok: boolean
  item: MemoryItem
  family: string
  stub: boolean
  stored: { original: string; extract: string }
  index: KnowledgeCard
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function uploadArtemisFile(
  file: File,
  opts?: { source?: 'bow' | 'quiver'; onProgress?: (percent: number) => void },
): Promise<ArtemisUploadResult> {
  return new Promise((resolve, reject) => {
    void fileToBase64(file)
      .then((contentBase64) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${API}/api/artemis/upload`)
        xhr.withCredentials = true
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          opts?.onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText) as ArtemisUploadResult & { error?: string }
            if (xhr.status >= 400 || !parsed.ok) {
              reject(new Error(parsed.error || xhr.statusText || 'Upload failed'))
              return
            }
            opts?.onProgress?.(100)
            resolve(parsed)
          } catch {
            reject(new Error(xhr.responseText || 'Upload failed'))
          }
        }
        xhr.send(
          JSON.stringify({
            name: file.name,
            mimeType: file.type,
            contentBase64,
            source: opts?.source ?? 'bow',
          }),
        )
      })
      .catch(reject)
  })
}

export async function fetchMemoryBoard() {
  const res = await fetch(`${API}/api/artemis/memory`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    ok: boolean
    sections: typeof MEMORY_SECTIONS
    board: Record<MemoryKind, MemoryItem[]>
    chronicle: ChronicleCheck[]
    activeVoice: VoiceId
  }>
}

export async function fetchChronicle() {
  const res = await fetch(`${API}/api/artemis/chronicle`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; checks: ChronicleCheck[] }>
}

export async function pinMemory(kind: MemoryKind, id: string, pinned?: boolean) {
  const res = await fetch(`${API}/api/artemis/memory/${kind}/${id}/pin`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pinned === undefined ? {} : { pinned }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; item: MemoryItem }>
}

export async function editMemory(kind: MemoryKind, id: string, patch: { title?: string; body?: string }) {
  const res = await fetch(`${API}/api/artemis/memory/${kind}/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; item: MemoryItem }>
}

export async function forgetMemory(kind: MemoryKind, id: string) {
  const res = await fetch(`${API}/api/artemis/memory/${kind}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean }>
}

export async function exportMemory(kind: MemoryKind, id: string) {
  const res = await fetch(`${API}/api/artemis/memory/${kind}/${id}/export`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; kind: MemoryKind; item: unknown }>
}

export type ChatStreamEvent =
  | { type: 'meta'; conversationId: string; voice: VoiceId }
  | { type: 'step'; id: string; status: 'in_progress' | 'done' }
  | { type: 'chunk'; text: string }
  | { type: 'done'; conversationId: string; voice: VoiceId }
  | { type: 'error'; error: string }

export async function fetchKnowledgeFile(id: string) {
  const res = await fetch(`${API}/api/artemis/knowledge/${encodeURIComponent(id)}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; file: KnowledgeCard }>
}

export async function touchKnowledgeFile(id: string) {
  const res = await fetch(`${API}/api/artemis/knowledge/${encodeURIComponent(id)}/touch`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; file: KnowledgeCard }>
}

export async function streamArtemisChat(
  input: { message: string; conversationId?: string; voice: VoiceId; knowledgeId?: string },
  onEvent: (event: ChatStreamEvent) => void,
) {
  const res = await fetch(`${API}/api/artemis/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson, application/json' },
    body: JSON.stringify({
      message: input.message,
      conversationId: input.conversationId,
      voice: input.voice,
      knowledgeId: input.knowledgeId,
    }),
  })
  if (!res.ok || !res.body) {
    throw new Error(await parseError(res))
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        onEvent(JSON.parse(line) as ChatStreamEvent)
      } catch {
        onEvent({ type: 'chunk', text: line })
      }
    }
  }
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as ChatStreamEvent)
    } catch {
      onEvent({ type: 'chunk', text: buffer })
    }
  }
}

export function memorySectionLabel(kind: MemoryKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function defaultVoice(): VoiceId {
  return DEFAULT_VOICE
}

export function consolePath(view: ConsoleView, extras?: Record<string, string>) {
  const params = new URLSearchParams({ view, ...extras })
  return `/console?${params.toString()}`
}
