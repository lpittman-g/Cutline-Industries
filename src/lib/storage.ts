import { DEMO_MOMENTS } from '../data/catalog'
import { generateClipDraft } from './copyEngine'
import type { AppState, Clip, Project, ShortsPack } from '../types'
import { uid } from './utils'

const STORAGE_KEY = 'cutline.v1'

function createDemoProject(): { project: Project; clips: Clip[]; pack: ShortsPack } {
  const now = Date.now()
  const project: Project = {
    id: uid('proj'),
    name: 'Ranked VOD — Night Session',
    game: 'Valorant',
    niche: 'fps',
    vodFileName: null,
    vodDuration: 600,
    vodObjectUrl: null,
    notes: 'Demo pack. Upload your own VOD to replace the scrubber duration.',
    createdAt: now,
    updatedAt: now,
  }
  const clips = DEMO_MOMENTS.map((m, i) =>
    generateClipDraft({
      projectId: project.id,
      game: project.game,
      niche: project.niche,
      label: m.label,
      start: m.start,
      end: m.end,
      seed: i * 7 + 3,
    }),
  ).map((c, i) => ({
    ...c,
    status: i < 3 ? ('ready' as const) : ('draft' as const),
  }))
  const pack: ShortsPack = {
    id: uid('pack'),
    projectId: project.id,
    name: 'Day-1 Drop Pack (10)',
    clipIds: clips.map((c) => c.id),
    theme: 'Clutch + tech for ranked climb',
    createdAt: now,
  }
  return { project, clips, pack }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.projects?.length) {
        return {
          ...parsed,
          projects: parsed.projects.map((p) => ({ ...p, vodObjectUrl: null })),
        }
      }
    }
  } catch {
    // ignore corrupt storage
  }
  const demo = createDemoProject()
  return {
    projects: [demo.project],
    clips: demo.clips,
    packs: [demo.pack],
    activeProjectId: demo.project.id,
  }
}

export function saveState(state: AppState): void {
  const serializable: AppState = {
    ...state,
    projects: state.projects.map((p) => ({ ...p, vodObjectUrl: null })),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
}

export function createBlankProject(): Project {
  const now = Date.now()
  return {
    id: uid('proj'),
    name: 'Untitled VOD',
    game: 'Valorant',
    niche: 'fps',
    vodFileName: null,
    vodDuration: 0,
    vodObjectUrl: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}
