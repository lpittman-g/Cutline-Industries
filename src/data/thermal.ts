export const THERMAL = {
  name: 'Thermal',
  description:
    'Autonomous real-time media network and web command center that converts stream chat velocity into monetized short-form video content.',
  discordBotCta: 'Add Thermal Bot to Discord',
  // Placeholder until Discord OAuth app URL is wired
  discordBotUrl: 'https://discord.com/application-directory',
  cutlineRole: 'Cutline API + FFmpeg powers clip cutting inside Thermal.',
}

export const THERMAL_TIERS = [
  {
    tier: 1,
    target: 'Streamers',
    description: 'Real-time, unwatermarked clip unlocks delivered directly to Discord while live.',
    pricing: '$15 Live Unlock',
  },
  {
    tier: 2,
    target: 'Fans & Community',
    description: 'Self-serve clip bundles posted to a public social media Bounty Board.',
    pricing: '$50 Bounty Bundle',
  },
  {
    tier: 3,
    target: 'Indie Game Developers',
    description: 'Recurring monthly ad packs built from creator gameplay to drive Steam wishlists.',
    pricing: '$750 – $2,500/mo Retainer',
  },
] as const

export type BountyClip = {
  id: string
  title: string
  streamer: string
  game: string
  heatScore: number
  msgPerMin: number
  durationSec: number
  watermarked: boolean
  priceLabel: string
}

/** Demo heat feed until live Twitch/Kick webhooks are connected. */
export const DEMO_BOUNTY_CLIPS: BountyClip[] = [
  {
    id: 'heat_01',
    title: 'Chat loses it on the clutch',
    streamer: 'nova_fps',
    game: 'Valorant',
    heatScore: 94,
    msgPerMin: 186,
    durationSec: 22,
    watermarked: true,
    priceLabel: '$15 Unlock',
  },
  {
    id: 'heat_02',
    title: 'Boss wipe — donation spam',
    streamer: 'pixelrift',
    game: 'Elden Ring',
    heatScore: 88,
    msgPerMin: 142,
    durationSec: 28,
    watermarked: true,
    priceLabel: '$15 Unlock',
  },
  {
    id: 'heat_03',
    title: 'Indie reveal moment',
    streamer: 'cozyqueue',
    game: 'Hollow Paths',
    heatScore: 91,
    msgPerMin: 160,
    durationSec: 19,
    watermarked: true,
    priceLabel: '$50 Bundle',
  },
  {
    id: 'heat_04',
    title: 'Rank-up scream',
    streamer: 'aimlab_lex',
    game: 'Apex Legends',
    heatScore: 85,
    msgPerMin: 128,
    durationSec: 24,
    watermarked: true,
    priceLabel: '$15 Unlock',
  },
]

export const DEMO_APP_KPIS = {
  totalRevenue: '$4,280',
  activeLiveChannels: 7,
  dailyClipsRendered: 126,
  pendingOutreaches: 11,
}
