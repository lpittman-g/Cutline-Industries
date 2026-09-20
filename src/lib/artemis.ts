export const ARTEMIS_COPY = {
  name: 'Artemis',
  kicker: 'AI by Cutline Industries',
  description:
    'Intelligence built for action. Artemis connects your tools, data, and AI workflows through one secure operational interface.',
  ecosystem: 'Works across your ecosystem',
  footer: 'Higher intelligence for a brighter tomorrow',
} as const

export const CAPABILITIES = [
  {
    id: 'bow',
    name: 'The Bow',
    hint: 'Execution console',
    blurb: 'Premium multi-model execution and generation console.',
    view: 'chat' as const,
    icon: 'bow',
  },
  {
    id: 'orion',
    name: 'Orion',
    hint: 'Research',
    blurb: 'Deep research, analysis, and strategic intelligence.',
    view: 'files' as const,
    icon: 'orion',
  },
  {
    id: 'chronicler',
    name: 'Chronicler',
    hint: 'Memory',
    blurb: 'Capture, organize, and turn your knowledge into lasting insights.',
    view: 'memory' as const,
    icon: 'chronicler',
  },
] as const

export const VOICES = {
  astra: { id: 'astra', label: 'Astra' },
  orion: { id: 'orion', label: 'Orion' },
  nova: { id: 'nova', label: 'Nova' },
  sage: { id: 'sage', label: 'Sage' },
} as const

export type VoiceId = keyof typeof VOICES
export const DEFAULT_VOICE: VoiceId = 'astra'

export const PROCESS_STEPS = [
  { id: 'understand', label: 'Understanding request' },
  { id: 'chronicle', label: 'Searching Chronicle' },
  { id: 'project', label: 'Reading project context' },
  { id: 'files', label: 'Processing files' },
  { id: 'generate', label: 'Generating response' },
  { id: 'learn', label: 'Updating knowledge' },
] as const

export type ProcessStepId = (typeof PROCESS_STEPS)[number]['id']
export type StepStatus = 'pending' | 'in_progress' | 'done'

export const MEMORY_SECTIONS = [
  'projects',
  'decisions',
  'preferences',
  'people',
  'files',
  'research',
  'conversations',
] as const

export type MemoryKind = (typeof MEMORY_SECTIONS)[number]

export const MEMORY_SOURCES: Record<MemoryKind, string> = {
  projects: 'projects.json',
  decisions: 'decisions.json',
  preferences: 'user-preferences.json',
  people: 'people.json',
  files: 'knowledge/',
  research: 'research/',
  conversations: 'conversations/',
}

export type ConsoleView = 'chat' | 'memory' | 'files' | 'logs'
export type QuiverEngine = 'orion' | 'iron'

export const CONSOLE_VIEWS: { id: ConsoleView; label: string; suffix: string }[] = [
  { id: 'chat', label: 'Chat', suffix: 'View' },
  { id: 'memory', label: 'Memory', suffix: 'View' },
  { id: 'files', label: 'Files', suffix: 'View' },
  { id: 'logs', label: 'Logs', suffix: 'View' },
]

export function parseConsoleView(value: string | null): ConsoleView {
  if (value === 'files' || value === 'logs' || value === 'chat' || value === 'memory') return value
  return 'chat'
}

export function parseMemorySection(value: string | null): MemoryKind {
  if (value && (MEMORY_SECTIONS as readonly string[]).includes(value)) return value as MemoryKind
  return 'projects'
}

export function parseQuiverEngine(value: string | null): QuiverEngine {
  return value === 'iron' ? 'iron' : 'orion'
}

export function isVoiceId(value: string | null | undefined): value is VoiceId {
  return Boolean(value && value in VOICES)
}

export type MemoryItem = {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  path?: string
}

export type ChronicleCheck = { id: string; label: string; done: boolean; kind?: MemoryKind }

export type ChatMessage = {
  role: 'operator' | 'artemis'
  content: string
}
