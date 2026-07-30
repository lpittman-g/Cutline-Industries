import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { generateClipDraft, refreshClipCopy } from '../lib/copyEngine'
import { createBlankProject, loadState, saveState } from '../lib/storage'
import { scoreClip, uid } from '../lib/utils'
import type { AppState, Clip, GameNiche, Project, ShortsPack } from '../types'

interface CutlineContextValue {
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

const CutlineContext = createContext<CutlineContextValue | null>(null)

export function CutlineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  const activeProject = useMemo(
    () => state.projects.find((p) => p.id === state.activeProjectId) ?? null,
    [state.projects, state.activeProjectId],
  )

  const projectClips = useMemo(
    () =>
      state.clips
        .filter((c) => c.projectId === state.activeProjectId)
        .sort((a, b) => a.start - b.start),
    [state.clips, state.activeProjectId],
  )

  const projectPacks = useMemo(
    () => state.packs.filter((p) => p.projectId === state.activeProjectId),
    [state.packs, state.activeProjectId],
  )

  const selectedClip = useMemo(
    () => projectClips.find((c) => c.id === selectedClipId) ?? null,
    [projectClips, selectedClipId],
  )

  const setActiveProjectId = useCallback((id: string) => {
    setState((s) => ({ ...s, activeProjectId: id }))
    setSelectedClipId(null)
  }, [])

  const createProject = useCallback(() => {
    const project = createBlankProject()
    setState((s) => ({
      ...s,
      projects: [project, ...s.projects],
      activeProjectId: project.id,
    }))
    setSelectedClipId(null)
    return project
  }, [])

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setState((s) => {
      const projects = s.projects.filter((p) => p.id !== id)
      const clips = s.clips.filter((c) => c.projectId !== id)
      const packs = s.packs.filter((p) => p.projectId !== id)
      const activeProjectId =
        s.activeProjectId === id ? projects[0]?.id ?? null : s.activeProjectId
      return { projects, clips, packs, activeProjectId }
    })
    setSelectedClipId(null)
  }, [])

  const addClip = useCallback(
    (partial?: Partial<Pick<Clip, 'start' | 'end' | 'label'>>) => {
      if (!activeProject) return null
      const start = partial?.start ?? 0
      const end = partial?.end ?? Math.min(start + 25, activeProject.vodDuration || start + 25)
      const clip = generateClipDraft({
        projectId: activeProject.id,
        game: activeProject.game,
        niche: activeProject.niche,
        label: partial?.label || `Clip ${projectClips.length + 1}`,
        start,
        end,
      })
      setState((s) => ({ ...s, clips: [...s.clips, clip] }))
      setSelectedClipId(clip.id)
      return clip
    },
    [activeProject, projectClips.length],
  )

  const updateClip = useCallback((id: string, patch: Partial<Clip>) => {
    setState((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id !== id) return c
        const next = { ...c, ...patch, updatedAt: Date.now() }
        next.score = scoreClip({
          duration: next.end - next.start,
          hasHook: Boolean(next.hook),
          hasTitle: Boolean(next.title),
          hashtags: next.hashtags.length,
          hasCta: Boolean(next.cta),
        })
        return next
      }),
    }))
  }, [])

  const deleteClip = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      clips: s.clips.filter((c) => c.id !== id),
      packs: s.packs.map((p) => ({
        ...p,
        clipIds: p.clipIds.filter((cid) => cid !== id),
      })),
    }))
    setSelectedClipId((curr) => (curr === id ? null : curr))
  }, [])

  const duplicateClip = useCallback(
    (id: string) => {
      const source = state.clips.find((c) => c.id === id)
      if (!source) return
      const copy: Clip = {
        ...source,
        id: uid('clip'),
        label: `${source.label} copy`,
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setState((s) => ({ ...s, clips: [...s.clips, copy] }))
      setSelectedClipId(copy.id)
    },
    [state.clips],
  )

  const regenerateCopy = useCallback(
    (id: string) => {
      if (!activeProject) return
      setState((s) => ({
        ...s,
        clips: s.clips.map((c) =>
          c.id === id ? refreshClipCopy(c, activeProject.game, activeProject.niche) : c,
        ),
      }))
    },
    [activeProject],
  )

  const markRange = useCallback(
    (start: number, end: number) => {
      addClip({ start, end, label: `Mark ${formatMark(start)}` })
    },
    [addClip],
  )

  const generatePack = useCallback(
    (count: number, theme: string) => {
      if (!activeProject) return null
      const ready = projectClips.filter((c) => c.status === 'ready' || c.status === 'draft')
      let pool = [...ready]
      if (pool.length < count) {
        const extras: Clip[] = []
        const span = Math.max(activeProject.vodDuration || 600, count * 40)
        for (let i = pool.length; i < count; i++) {
          const start = Math.floor((span / count) * i) + 5
          const end = start + 18 + (i % 10)
          extras.push(
            generateClipDraft({
              projectId: activeProject.id,
              game: activeProject.game,
              niche: activeProject.niche as GameNiche,
              label: `Auto ${i + 1}`,
              start,
              end: Math.min(end, span),
              seed: i * 11,
            }),
          )
        }
        pool = [...pool, ...extras]
        setState((s) => ({ ...s, clips: [...s.clips, ...extras] }))
      }
      const chosen = pool
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
      const pack: ShortsPack = {
        id: uid('pack'),
        projectId: activeProject.id,
        name: `${count}-Short Pack`,
        clipIds: chosen.map((c) => c.id),
        theme,
        createdAt: Date.now(),
      }
      setState((s) => ({
        ...s,
        packs: [pack, ...s.packs],
        clips: s.clips.map((c) =>
          chosen.some((x) => x.id === c.id) && c.status === 'draft'
            ? { ...c, status: 'ready' as const }
            : c,
        ),
      }))
      return pack
    },
    [activeProject, projectClips],
  )

  const deletePack = useCallback((id: string) => {
    setState((s) => ({ ...s, packs: s.packs.filter((p) => p.id !== id) }))
  }, [])

  const attachVod = useCallback(
    (file: File, duration: number, objectUrl: string) => {
      if (!activeProject) return
      if (activeProject.vodObjectUrl) URL.revokeObjectURL(activeProject.vodObjectUrl)
      updateProject(activeProject.id, {
        vodFileName: file.name,
        vodDuration: duration,
        vodObjectUrl: objectUrl,
        name: activeProject.name === 'Untitled VOD' ? file.name.replace(/\.[^.]+$/, '') : activeProject.name,
      })
    },
    [activeProject, updateProject],
  )

  const clearVod = useCallback(() => {
    if (!activeProject) return
    if (activeProject.vodObjectUrl) URL.revokeObjectURL(activeProject.vodObjectUrl)
    updateProject(activeProject.id, {
      vodFileName: null,
      vodDuration: activeProject.vodDuration || 0,
      vodObjectUrl: null,
    })
  }, [activeProject, updateProject])

  const value: CutlineContextValue = {
    state,
    activeProject,
    projectClips,
    projectPacks,
    selectedClipId,
    selectedClip,
    setSelectedClipId,
    setActiveProjectId,
    createProject,
    updateProject,
    deleteProject,
    addClip,
    updateClip,
    deleteClip,
    duplicateClip,
    regenerateCopy,
    markRange,
    generatePack,
    deletePack,
    attachVod,
    clearVod,
  }

  return <CutlineContext.Provider value={value}>{children}</CutlineContext.Provider>
}

export function useCutline() {
  const ctx = useContext(CutlineContext)
  if (!ctx) throw new Error('useCutline must be used within CutlineProvider')
  return ctx
}

function formatMark(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m${String(s).padStart(2, '0')}s`
}
