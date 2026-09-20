import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ROOT } from '../youtubeAuth.ts'

export const ARTEMIS_DATA = path.join(ROOT, 'artemis-data')

export const VOICES = {
  astra: { id: 'astra', label: 'Astra' },
  orion: { id: 'orion', label: 'Orion' },
  nova: { id: 'nova', label: 'Nova' },
  sage: { id: 'sage', label: 'Sage' },
} as const

export type VoiceId = keyof typeof VOICES
export const DEFAULT_VOICE: VoiceId = 'astra'

export function isVoiceId(value: string | undefined): value is VoiceId {
  return Boolean(value && value in VOICES)
}

export const PROCESS_STEPS = [
  { id: 'understand', label: 'Understanding request' },
  { id: 'chronicle', label: 'Searching Chronicle' },
  { id: 'project', label: 'Reading project context' },
  { id: 'files', label: 'Processing files' },
  { id: 'generate', label: 'Generating response' },
  { id: 'learn', label: 'Updating knowledge' },
] as const

export type ProcessStepId = (typeof PROCESS_STEPS)[number]['id']

export const MEMORY_KINDS = [
  'projects',
  'decisions',
  'preferences',
  'people',
  'files',
  'research',
  'conversations',
] as const

export type MemoryKind = (typeof MEMORY_KINDS)[number]

export type MemoryItem = {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  path?: string
  kind?: string
}

type ItemFile = { items: MemoryItem[]; activeVoice?: VoiceId; voiceEnabled?: boolean; memoryEnabled?: boolean }

const KIND_FILE: Record<Exclude<MemoryKind, 'preferences' | 'research' | 'conversations'>, string> = {
  projects: 'projects.json',
  decisions: 'decisions.json',
  people: 'people.json',
  files: 'files.json',
}

export function nowIso() {
  return new Date().toISOString()
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function ensureArtemisData() {
  await fs.mkdir(path.join(ARTEMIS_DATA, 'conversations'), { recursive: true })
  await fs.mkdir(path.join(ARTEMIS_DATA, 'knowledge'), { recursive: true })
  await fs.mkdir(path.join(ARTEMIS_DATA, 'research'), { recursive: true })
  await fs.mkdir(path.join(ARTEMIS_DATA, 'logs'), { recursive: true })
  const activity = path.join(ARTEMIS_DATA, 'logs', 'activity.jsonl')
  try {
    await fs.access(activity)
  } catch {
    await fs.writeFile(activity, '', 'utf8')
  }
}

export async function appendActivity(event: string, detail: string) {
  await ensureArtemisData()
  const line = JSON.stringify({ at: nowIso(), event, detail })
  await fs.appendFile(path.join(ARTEMIS_DATA, 'logs', 'activity.jsonl'), `${line}\n`, 'utf8')
}

export async function readPreferences() {
  return readJson<ItemFile>(path.join(ARTEMIS_DATA, 'user-preferences.json'), {
    items: [],
    activeVoice: DEFAULT_VOICE,
    voiceEnabled: true,
    memoryEnabled: true,
  })
}

export async function writePreferences(value: ItemFile) {
  await writeJson(path.join(ARTEMIS_DATA, 'user-preferences.json'), value)
}

export async function getActiveVoice(): Promise<VoiceId> {
  const prefs = await readPreferences()
  return isVoiceId(prefs.activeVoice) ? prefs.activeVoice : DEFAULT_VOICE
}

export async function setActiveVoice(voice: VoiceId) {
  const prefs = await readPreferences()
  prefs.activeVoice = voice
  const row = prefs.items.find((i) => i.id === 'pref_voice')
  if (row) {
    row.body = voice
    row.updatedAt = nowIso()
  }
  await writePreferences(prefs)
}

export type ConversationMessage = {
  role: 'operator' | 'artemis'
  content: string
  at: string
}

export type Conversation = {
  id: string
  title: string
  voice: VoiceId
  updatedAt: string
  messages: ConversationMessage[]
}

export async function listConversations(): Promise<Conversation[]> {
  const dir = path.join(ARTEMIS_DATA, 'conversations')
  await fs.mkdir(dir, { recursive: true })
  const names = await fs.readdir(dir)
  const out: Conversation[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const conv = await readJson<Conversation | null>(path.join(dir, name), null)
    if (conv?.id) out.push(conv)
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return out
}

export async function readConversation(id: string): Promise<Conversation | null> {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safe) return null
  return readJson<Conversation | null>(path.join(ARTEMIS_DATA, 'conversations', `${safe}.json`), null)
}

export async function writeConversation(conv: Conversation) {
  const safe = conv.id.replace(/[^a-zA-Z0-9_-]/g, '')
  await writeJson(path.join(ARTEMIS_DATA, 'conversations', `${safe}.json`), conv)
}

export async function listKnowledgeFiles() {
  const dir = path.join(ARTEMIS_DATA, 'knowledge')
  await fs.mkdir(dir, { recursive: true })
  const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.md'))
  const files: { name: string; body: string }[] = []
  for (const name of names) {
    const body = await fs.readFile(path.join(dir, name), 'utf8')
    files.push({ name, body })
  }
  return files
}

async function listResearchItems(): Promise<MemoryItem[]> {
  const dir = path.join(ARTEMIS_DATA, 'research')
  await fs.mkdir(dir, { recursive: true })
  const names = await fs.readdir(dir)
  const items: MemoryItem[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const row = await readJson<MemoryItem | null>(path.join(dir, name), null)
    if (row?.id) items.push(row)
  }
  return items
}

async function writeResearchItem(item: MemoryItem) {
  await writeJson(path.join(ARTEMIS_DATA, 'research', `${item.id}.json`), item)
}

async function readKindItems(kind: MemoryKind): Promise<MemoryItem[]> {
  if (kind === 'preferences') return (await readPreferences()).items
  if (kind === 'research') return listResearchItems()
  if (kind === 'conversations') {
    const convos = await listConversations()
    return convos.map((c) => ({
      id: c.id,
      title: c.title,
      body: c.messages.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 1200),
      pinned: false,
      createdAt: c.messages[0]?.at ?? c.updatedAt,
      updatedAt: c.updatedAt,
    }))
  }
  const file = KIND_FILE[kind]
  const data = await readJson<ItemFile>(path.join(ARTEMIS_DATA, file), { items: [] })
  return data.items ?? []
}

async function writeKindItems(kind: MemoryKind, items: MemoryItem[]) {
  if (kind === 'preferences') {
    const prefs = await readPreferences()
    prefs.items = items
    await writePreferences(prefs)
    return
  }
  if (kind === 'research') {
    const dir = path.join(ARTEMIS_DATA, 'research')
    const existing = (await fs.readdir(dir)).filter((n) => n.endsWith('.json'))
    const keep = new Set(items.map((i) => `${i.id}.json`))
    for (const name of existing) {
      if (!keep.has(name)) await fs.unlink(path.join(dir, name))
    }
    for (const item of items) await writeResearchItem(item)
    return
  }
  if (kind === 'conversations') {
    for (const item of items) {
      const conv = await readConversation(item.id)
      if (!conv) continue
      conv.title = item.title
      conv.updatedAt = nowIso()
      await writeConversation(conv)
    }
    return
  }
  const file = KIND_FILE[kind]
  await writeJson(path.join(ARTEMIS_DATA, file), { items })
}

export async function loadMemoryBoard() {
  const board: Record<MemoryKind, MemoryItem[]> = {
    projects: [],
    decisions: [],
    preferences: [],
    people: [],
    files: [],
    research: [],
    conversations: [],
  }
  for (const kind of MEMORY_KINDS) {
    board[kind] = await readKindItems(kind)
  }
  return board
}

export async function updateMemoryItem(
  kind: MemoryKind,
  id: string,
  patch: Partial<Pick<MemoryItem, 'title' | 'body' | 'pinned'>>,
) {
  if (kind === 'conversations') {
    const conv = await readConversation(id)
    if (!conv) return null
    if (patch.title) conv.title = patch.title
    conv.updatedAt = nowIso()
    await writeConversation(conv)
    return {
      id: conv.id,
      title: conv.title,
      body: conv.messages.at(-1)?.content ?? '',
      pinned: Boolean(patch.pinned),
      createdAt: conv.messages[0]?.at ?? conv.updatedAt,
      updatedAt: conv.updatedAt,
    } satisfies MemoryItem
  }
  const items = await readKindItems(kind)
  const idx = items.findIndex((i) => i.id === id)
  if (idx < 0) return null
  const next = { ...items[idx], ...patch, updatedAt: nowIso() }
  items[idx] = next
  await writeKindItems(kind, items)
  await appendActivity('memory.update', `${kind}/${id}`)
  return next
}

export async function forgetMemoryItem(kind: MemoryKind, id: string) {
  if (kind === 'conversations') {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '')
    const file = path.join(ARTEMIS_DATA, 'conversations', `${safe}.json`)
    try {
      await fs.unlink(file)
      await appendActivity('memory.forget', `${kind}/${id}`)
      return true
    } catch {
      return false
    }
  }
  const items = await readKindItems(kind)
  const next = items.filter((i) => i.id !== id)
  if (next.length === items.length) return false
  await writeKindItems(kind, next)
  await appendActivity('memory.forget', `${kind}/${id}`)
  return true
}

async function readNotes(): Promise<MemoryItem[]> {
  const data = await readJson<{ items: MemoryItem[] }>(path.join(ARTEMIS_DATA, 'memory.json'), { items: [] })
  return data.items ?? []
}

async function writeNotes(items: MemoryItem[]) {
  await writeJson(path.join(ARTEMIS_DATA, 'memory.json'), { items })
}

export async function addMemoryItem(kind: MemoryKind | 'notes', title: string, body: string) {
  const item: MemoryItem = {
    id: uid(kind.slice(0, 4)),
    title,
    body,
    pinned: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  if (kind === 'conversations') return item
  if (kind === 'notes') {
    const notes = await readNotes()
    notes.unshift(item)
    await writeNotes(notes)
    await appendActivity('memory.add', `notes/${item.id}`)
    return item
  }
  const items = await readKindItems(kind)
  items.unshift(item)
  await writeKindItems(kind, items)
  await appendActivity('memory.add', `${kind}/${item.id}`)
  return item
}

export async function loadChronicleChecklist() {
  const board = await loadMemoryBoard()
  const knowledge = await listKnowledgeFiles()
  const checks = [
    ...board.projects.filter((i) => i.pinned).map((i) => ({ id: i.id, label: `Project · ${i.title}`, done: true })),
    ...board.decisions.slice(0, 3).map((i) => ({ id: i.id, label: `Decision · ${i.title}`, done: true })),
    ...knowledge.map((k) => ({ id: k.name, label: `Knowledge · ${k.name}`, done: true })),
    ...board.files.slice(0, 3).map((i) => ({ id: i.id, label: `File · ${i.title}`, done: true })),
  ]
  return checks.slice(0, 8)
}

export type MemoryContext = {
  voice: VoiceId
  snippets: string[]
  projects: string[]
  files: string[]
}

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'what', 'when'])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

export function scoreText(haystack: string, tokens: string[]): number {
  const lower = haystack.toLowerCase()
  return tokens.reduce((sum, t) => sum + (lower.includes(t) ? 1 : 0), 0)
}

export async function loadRelevantMemory(userMessage: string): Promise<MemoryContext> {
  const tokens = tokenize(userMessage)
  const board = await loadMemoryBoard()
  const knowledge = await listKnowledgeFiles()
  const voice = await getActiveVoice()
  const pool: { score: number; text: string }[] = []

  for (const kind of MEMORY_KINDS) {
    for (const item of board[kind]) {
      const blob = `${item.title}\n${item.body}`
      const score = scoreText(blob, tokens) + (item.pinned ? 0.5 : 0)
      if (score > 0) pool.push({ score, text: `[${kind}] ${item.title}: ${item.body}` })
    }
  }
  for (const item of await readNotes()) {
    const score = scoreText(`${item.title}\n${item.body}`, tokens) + (item.pinned ? 0.5 : 0)
    if (score > 0) pool.push({ score, text: `[notes] ${item.title}: ${item.body}` })
  }
  for (const file of knowledge) {
    const score = scoreText(`${file.name}\n${file.body}`, tokens) + 0.25
    if (score > 0) pool.push({ score, text: `[knowledge/${file.name}] ${file.body.slice(0, 600)}` })
  }

  pool.sort((a, b) => b.score - a.score)
  return {
    voice,
    snippets: pool.slice(0, 6).map((p) => p.text),
    projects: board.projects.map((p) => p.title),
    files: board.files.map((f) => f.title),
  }
}

export async function extractAndStoreLearning(input: { userMessage: string; response: string }) {
  const text = `${input.userMessage}\n${input.response}`
  const lower = input.userMessage.toLowerCase()
  if (/\b(prefer|always|never|remember)\b/.test(lower)) {
    await addMemoryItem('preferences', input.userMessage.slice(0, 72) || 'Preference', input.userMessage)
  } else if (/\b(decide|decision|we will|going with)\b/.test(lower)) {
    await addMemoryItem('decisions', input.userMessage.slice(0, 72) || 'Decision', text.slice(0, 400))
  } else if (tokenize(input.userMessage).length >= 4) {
    await addMemoryItem('research', 'Hunt note', `${input.userMessage.slice(0, 160)} → ${input.response.slice(0, 240)}`)
  }
  await appendActivity('learn', input.userMessage.slice(0, 180))
}

export async function runArtemis(input: { message: string; context: MemoryContext; voice: VoiceId }): Promise<string> {
  const contextBlock = input.context.snippets.length
    ? input.context.snippets.map((s) => `- ${s}`).join('\n')
    : '- No matching Chronicle entries yet.'
  const stub = [
    `${VOICES[input.voice].label} here — The Bow is live.`,
    '',
    `You said: ${input.message.trim()}`,
    '',
    'Chronicle context:',
    contextBlock,
    '',
    input.context.projects.length ? `Active projects: ${input.context.projects.join(', ')}.` : '',
    'Next: keep this in Chronicler, or open Memory to pin / forget what I should know.',
  ]
    .filter(Boolean)
    .join('\n')

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return stub

  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Artemis (${VOICES[input.voice].label} voice) for Cutline Industries. Be operational and concise. Use Chronicle context when relevant.\n\n${contextBlock}`,
        },
        { role: 'user', content: input.message },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() || stub
  } catch {
    return stub
  }
}
