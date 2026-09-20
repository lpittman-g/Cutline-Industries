export const ARTEMIS_COPY = {
  name: 'Artemis',
  kicker: 'AI by Cutline Industries',
  description:
    'Intelligence built for action. Artemis connects your tools, data, and AI workflows through one secure operational interface.',
} as const

export const CAPABILITIES = [
  {
    id: 'bow',
    name: 'The Bow',
    hint: 'Execution console',
    blurb: 'Premium multi-model generation. Draw the string, pick an engine, and fire operational output.',
    view: 'chat',
  },
  {
    id: 'orion',
    name: 'Orion',
    hint: 'Vector store',
    blurb: 'Local vector pool for PDFs, docs, and tables — the ingestion layer behind The Quiver.',
    view: 'files',
  },
  {
    id: 'chronicler',
    name: 'Chronicler',
    hint: 'Hunt memory',
    blurb: 'Thread every hunt so prompts, engines, and results stay together across sessions.',
    view: 'chat',
  },
] as const

export type ConsoleView = 'chat' | 'files' | 'logs'
export type QuiverEngine = 'orion' | 'iron'
export type BowModel = 'Artemis Core' | 'OpenAI GPT-4o' | 'Anthropic Claude' | 'Grok'

export const BOW_MODELS: BowModel[] = [
  'Artemis Core',
  'OpenAI GPT-4o',
  'Anthropic Claude',
  'Grok',
]

export const CONSOLE_VIEWS: { id: ConsoleView; label: string; suffix: string }[] = [
  { id: 'chat', label: 'Chat', suffix: 'View' },
  { id: 'files', label: 'Files', suffix: 'View' },
  { id: 'logs', label: 'Logs', suffix: 'View' },
]

export function parseConsoleView(value: string | null): ConsoleView {
  if (value === 'files' || value === 'logs' || value === 'chat') return value
  return 'chat'
}

export function parseQuiverEngine(value: string | null): QuiverEngine {
  return value === 'iron' ? 'iron' : 'orion'
}

export type HuntMessage = {
  role: 'operator' | 'artemis'
  content: string
}

export type HuntThread = {
  id: string
  title: string
  engine: BowModel
  messages: HuntMessage[]
}

const HUNT_STORE_KEY = 'artemis.chronicler.threads'

export function loadHunts(): HuntThread[] {
  try {
    const raw = localStorage.getItem(HUNT_STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HuntThread[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHunts(threads: HuntThread[]): void {
  localStorage.setItem(HUNT_STORE_KEY, JSON.stringify(threads))
}

export function formatHuntHistory(messages: HuntMessage[]): string {
  if (!messages.length) return '(empty thread)'
  return messages
    .map((m) => `[${m.role === 'operator' ? 'OPERATOR' : 'ARTEMIS'}]\n${m.content}`)
    .join('\n\n')
}
