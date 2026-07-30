export type ClipStatus = 'draft' | 'ready' | 'exported' | 'published'

export type GameNiche =
  | 'fps'
  | 'moba'
  | 'survival'
  | 'rpg'
  | 'racing'
  | 'fighting'
  | 'cozy'
  | 'variety'

export interface Clip {
  id: string
  projectId: string
  label: string
  start: number
  end: number
  hook: string
  title: string
  description: string
  hashtags: string[]
  cta: string
  status: ClipStatus
  score: number
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  game: string
  niche: GameNiche
  vodFileName: string | null
  vodDuration: number
  vodObjectUrl: string | null
  notes: string
  createdAt: number
  updatedAt: number
}

export interface ShortsPack {
  id: string
  projectId: string
  name: string
  clipIds: string[]
  theme: string
  createdAt: number
}

export interface AppState {
  projects: Project[]
  clips: Clip[]
  packs: ShortsPack[]
  activeProjectId: string | null
}

export interface TitleRecipe {
  id: string
  label: string
  template: string
}

export interface HookPattern {
  id: string
  label: string
  text: string
}
