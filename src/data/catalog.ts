import type { GameNiche, HookPattern, TitleRecipe } from '../types'

export const NICHE_LABELS: Record<GameNiche, string> = {
  fps: 'FPS / Tactical',
  moba: 'MOBA',
  survival: 'Survival / Crafting',
  rpg: 'RPG / Souls',
  racing: 'Racing',
  fighting: 'Fighting',
  cozy: 'Cozy / Casual',
  variety: 'Variety',
}

export const TITLE_RECIPES: TitleRecipe[] = [
  { id: 'impossible', label: 'Impossible flex', template: 'I {action} with {constraint}' },
  { id: 'mistake', label: 'Mistake fix', template: 'Stop {mistake} — do this instead' },
  { id: 'clutch', label: 'Clutch moment', template: '{seconds}s clutch that saved the game' },
  { id: 'secret', label: 'Secret tech', template: 'The {game} trick nobody uses' },
  { id: 'rank', label: 'Rank climb', template: 'How I hit {rank} using one rule' },
  { id: 'fail', label: 'Fail → win', template: 'I threw… then this happened' },
  { id: 'challenge', label: 'Challenge', template: '{challenge} challenge (gone wrong?)' },
  { id: 'patch', label: 'Patch meta', template: 'New patch broke {thing} — here\'s why' },
  { id: 'speed', label: 'Speed', template: '{thing} in under {seconds} seconds' },
  { id: 'vs', label: 'Versus', template: '{hero} vs everyone (no mercy)' },
]

export const HOOK_PATTERNS: HookPattern[] = [
  { id: 'wait', label: 'Wait for it', text: 'Wait for the last second…' },
  { id: 'nobody', label: 'Nobody expected', text: 'Nobody expected this play.' },
  { id: 'wrong', label: 'You\'re doing it wrong', text: 'If you still do it the old way, you\'re throwing.' },
  { id: 'bet', label: 'Bet', text: 'I bet you can\'t do this first try.' },
  { id: 'rank', label: 'Rank gate', text: 'This one habit separates gold from diamond.' },
  { id: 'broken', label: 'Broken', text: 'This should be illegal.' },
  { id: 'quiet', label: 'Quiet flex', text: 'No commentary. Just the clip.' },
  { id: 'countdown', label: 'Countdown', text: '3… 2… 1… watch the angle.' },
  { id: 'coach', label: 'Coach mode', text: 'Pause. What would you do here?' },
  { id: 'revenge', label: 'Revenge', text: 'They beamed me first. Bad idea.' },
]

export const HASHTAG_SETS: Record<GameNiche, string[]> = {
  fps: ['#FPS', '#Clutch', '#Shorts', '#Ranked', '#AimLabs', '#Esports'],
  moba: ['#MOBA', '#Shorts', '#Macro', '#Outplay', '#Ranked', '#Esports'],
  survival: ['#Survival', '#BaseBuild', '#Shorts', '#Crafting', '#Hardcore'],
  rpg: ['#RPG', '#BossFight', '#Shorts', '#BuildGuide', '#Lore'],
  racing: ['#Racing', '#SimRacing', '#Shorts', '#LapTime', '#Crash'],
  fighting: ['#FGC', '#Combos', '#Shorts', '#Punish', '#Tournament'],
  cozy: ['#Cozy', '#Chill', '#Shorts', '#Aesthetic', '#Relax'],
  variety: ['#Creators', '#Shorts', '#Variety', '#Clips', '#Streamer'],
}

export const CTA_OPTIONS = [
  'Subscribe for part 2',
  'Follow for daily ranked clips',
  'Comment your rank if you\'d hit this',
  'Save this for your next game',
  'Join the Discord — link in bio',
  'Which clip next: A or B?',
]

export const PUBLISH_CHECKLIST = [
  { id: 'hook', label: 'First frame hooks in under 1 second' },
  { id: 'vertical', label: 'Vertical 9:16 crop frames the action' },
  { id: 'captions', label: 'Burned-in or auto captions on' },
  { id: 'loop', label: 'Ending loops cleanly into the start' },
  { id: 'title', label: 'Title under 70 chars, outcome-first' },
  { id: 'hashtags', label: '3–5 niche hashtags' },
  { id: 'cta', label: 'Spoken or on-screen subscribe CTA after the payoff' },
  { id: 'end', label: 'End screen / related Short pinned' },
  { id: 'cross', label: 'Same cut posted to TikTok + Reels same day' },
  { id: 'reply', label: 'Reply to first 10 comments in the first hour' },
]

export const DEMO_MOMENTS = [
  { label: 'Opening ace', start: 12, end: 38, vibe: 'clutch' },
  { label: 'Wallbang punish', start: 54, end: 79, vibe: 'secret' },
  { label: '1v4 spiral', start: 110, end: 148, vibe: 'clutch' },
  { label: 'Bad peek → redemption', start: 180, end: 215, vibe: 'fail' },
  { label: 'Utility lineup', start: 240, end: 268, vibe: 'secret' },
  { label: 'Overtime dagger', start: 300, end: 336, vibe: 'clutch' },
  { label: 'Crosshair placement tip', start: 360, end: 392, vibe: 'mistake' },
  { label: 'Eco round steal', start: 420, end: 455, vibe: 'impossible' },
  { label: 'Rotate read', start: 480, end: 510, vibe: 'coach' },
  { label: 'Final round freeze', start: 540, end: 575, vibe: 'countdown' },
]
