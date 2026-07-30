import { CTA_OPTIONS, HASHTAG_SETS, HOOK_PATTERNS, TITLE_RECIPES } from '../src/data/catalog.ts'
import type { GameNiche } from '../src/types.ts'

export type PlannedClip = {
  label: string
  start: number
  end: number
  title: string
  hook: string
  description: string
  tags: string[]
  cta: string
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? key)
}

const ACTIONS: Record<GameNiche, string[]> = {
  fps: ['aced', 'one-tapped', 'wallbanged', 'clutched', 'flicked'],
  moba: ['outplayed', 'stole Baron', 'pentakilled', 'baited', 'solo killed'],
  survival: ['raided', 'hardcore cleared', 'built', 'tamed', 'escaped'],
  rpg: ['no-hit', 'parried', 'one-shot', 'speedran', 'broke'],
  racing: ['overtook', 'drifted', 'pole-sat', 'crashed into', 'cut'],
  fighting: ['perfect-parried', 'comboed', 'punished', 'toasted', 'edged'],
  cozy: ['decorated', 'befriended', 'harvested', 'discovered', 'crafted'],
  variety: ['won', 'broke', 'speedran', 'challenged', 'melted'],
}

export function planClipsFromDuration(opts: {
  duration: number
  game: string
  niche: GameNiche
  maxClips: number
  clipSeconds: number
}): PlannedClip[] {
  const { duration, game, niche, maxClips, clipSeconds } = opts
  if (duration < 8) return []

  const usable = Math.max(duration - 10, clipSeconds)
  const spacing = Math.max(clipSeconds + 8, usable / maxClips)
  const clips: PlannedClip[] = []

  for (let i = 0; i < maxClips; i++) {
    const start = Math.min(5 + i * spacing, Math.max(duration - clipSeconds - 1, 0))
    const end = Math.min(start + clipSeconds, duration - 0.25)
    if (end - start < 6) break

    const recipe = pick(TITLE_RECIPES, i + 3)
    const title = fill(recipe.template, {
      action: pick(ACTIONS[niche], i),
      constraint: pick(['one HP', 'pistol only', 'no utility', 'eco buy'], i),
      mistake: pick(['wide peeking', 'panic spraying', 'late rotates'], i),
      seconds: String(Math.round(end - start)),
      game,
      rank: pick(['Diamond', 'Immortal', 'Radiant'], i),
      challenge: pick(['Knife only', 'No HUD', 'One life'], i),
      thing: pick(['the meta', 'this tech', 'entry fragging'], i),
      hero: game,
    })
    const hook = pick(HOOK_PATTERNS, i).text
    const cta = pick(CTA_OPTIONS, i)
    const tags = [`#${game.replace(/[^a-zA-Z0-9]/g, '')}`, ...HASHTAG_SETS[niche]].slice(0, 6)
    const description = [hook, '', title, '', `Game: ${game}`, cta, '', tags.join(' ')].join('\n')

    clips.push({
      label: `auto_${String(i + 1).padStart(2, '0')}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      title: title.slice(0, 95),
      hook,
      description,
      tags: tags.map((t) => t.replace(/^#/, '')),
      cta,
    })
  }

  return clips
}
