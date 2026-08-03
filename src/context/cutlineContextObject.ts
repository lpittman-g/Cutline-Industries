import { createContext, useContext } from 'react'
import type { AppState, Clip, Project, ShortsPack } from '../types'

export interface CutlineContextValue {
  state: AppState
  activeProject: Project | null
  projectClips: Clip[]
  projectPacks: ShortsPack[]
  selectedClipId: string | null
  selectedClip: Clip | null
  setSelectedClipId: (id: string | null) => void
  setActiveProjectId: (id: string) => void
  createProject: () => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  addClip: (partial?: Partial<Pick<Clip, 'start' | 'end' | 'label'>>) => Clip | null
  updateClip: (id: string, patch: Partial<Clip>) => void
  deleteClip: (id: string) => void
  duplicateClip: (id: string) => void
  regenerateCopy: (id: string) => void
  markRange: (start: number, end: number) => void
  generatePack: (count: number, theme: string) => ShortsPack | null
  deletePack: (id: string) => void
  attachVod: (file: File, duration: number, objectUrl: string) => void
  clearVod: () => void
}

export const CutlineContext = createContext<CutlineContextValue | null>(null)

export function useCutline() {
  const ctx = useContext(CutlineContext)
  if (!ctx) throw new Error('useCutline must be used within CutlineProvider')
  return ctx
}
