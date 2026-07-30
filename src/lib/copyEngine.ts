import { CTA_OPTIONS, HASHTAG_SETS, HOOK_PATTERNS, TITLE_RECIPES } from '../data/catalog'
import type { Clip, GameNiche } from '../types'
import { scoreClip, uid } from './utils'

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function fillTemplate(template: string, vars: Record<string, string>): string {
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

const CONSTRAINTS = [
  'one HP',
  'a pistol only',
  'no sound',
  'a controller',
  'zero utility',
  'my worst agent',
  'an eco buy',
  'a blindfold challenge',
]

const MISTAKES = [
  'wide peeking',
  'holding the wrong angle',
  'saving ult too long',
  'ignoring footsteps',
  'rotating late',
  'panic spraying',
]

export function generateTitle(game: string, niche: GameNiche, seed = 0): string {
  const recipe = pick(TITLE_RECIPES, seed)
  return fillTemplate(recipe.template, {
    action: pick(ACTIONS[niche], seed),
    constraint: pick(CONSTRAINTS, seed + 1),
    mistake: pick(MISTAKES, seed + 2),
    seconds: String(8 + (seed % 20)),
    game: game || 'this game',
    rank: pick(['Diamond', 'Immortal', 'Radiant', 'Grandmaster', 'Top 500'], seed),
    challenge: pick(['Knife only', 'No HUD', 'One life', 'Random loadout'], seed),
    thing: pick(['the meta', 'this tech', 'entry fragging', 'the boss'], seed),
    hero: game || 'Main',
  })
}

export function generateHook(seed = 0): string {
  return pick(HOOK_PATTERNS, seed).text
}

export function generateHashtags(niche: GameNiche, game: string): string[] {
  const base = [...HASHTAG_SETS[niche]]
  const gameTag = `#${game.replace(/[^a-zA-Z0-9]/g, '')}`
  if (gameTag.length > 2 && !base.includes(gameTag)) base.unshift(gameTag)
  return base.slice(0, 6)
}

export function generateDescription(clip: Pick<Clip, 'hook' | 'title' | 'cta'>, game: string): string {
  return [
    clip.hook,
    '',
    clip.title,
    '',
    `Game: ${game}`,
    clip.cta,
    '',
    'Part of a Shorts pack cut for retention — watch to the end.',
  ].join('\n')
}

export function generateClipDraft(opts: {
  projectId: string
  game: string
  niche: GameNiche
  label: string
  start: number
  end: number
  seed?: number
}): Clip {
  const seed = opts.seed ?? Math.floor(Math.random() * 1000)
  const hook = generateHook(seed)
  const title = generateTitle(opts.game, opts.niche, seed)
  const hashtags = generateHashtags(opts.niche, opts.game)
  const cta = pick(CTA_OPTIONS, seed)
  const now = Date.now()
  const draft: Clip = {
    id: uid('clip'),
    projectId: opts.projectId,
    label: opts.label,
    start: opts.start,
    end: opts.end,
    hook,
    title,
    description: '',
    hashtags,
    cta,
    status: 'draft',
    score: 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
  draft.description = generateDescription(draft, opts.game)
  draft.score = scoreClip({
    duration: opts.end - opts.start,
    hasHook: Boolean(hook),
    hasTitle: Boolean(title),
    hashtags: hashtags.length,
    hasCta: Boolean(cta),
  })
  return draft
}

export function refreshClipCopy(clip: Clip, game: string, niche: GameNiche): Clip {
  const seed = Math.floor(Math.random() * 1000)
  const hook = generateHook(seed)
  const title = generateTitle(game, niche, seed)
  const hashtags = generateHashtags(niche, game)
  const cta = pick(CTA_OPTIONS, seed)
  const next = {
    ...clip,
    hook,
    title,
    hashtags,
    cta,
    updatedAt: Date.now(),
  }
  next.description = generateDescription(next, game)
  next.score = scoreClip({
    duration: clip.end - clip.start,
    hasHook: true,
    hasTitle: true,
    hashtags: hashtags.length,
    hasCta: true,
  })
  return next
}
