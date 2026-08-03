/** Cutline Industries / Thermal — dedicated project content pillars. */

export type ProjectPillar = 'product' | 'streamers' | 'indie-devs' | 'behind-the-build'

export type ProjectTopic = {
  id: string
  title: string
  pillar: ProjectPillar
  keywords: string[]
  angle: string
  cta: string
}

export const PROJECT = {
  brand: 'Cutline Industries',
  product: 'Thermal',
  tagline: 'Turn live stream heat into monetized Shorts',
  site: 'cutline-industries.studio',
  siteUrl: 'https://cutline-industries.studio',
  email: 'lpittman@cutline-industries.studio',
  discordCta: 'Add Thermal Bot to Discord',
} as const

/** Rotating Shorts topics — all dedicated to the Thermal product & business. */
export const PROJECT_TOPICS: ProjectTopic[] = [
  {
    id: 'thermal-heat',
    title: 'How Thermal turns stream chat heat into monetized Shorts',
    pillar: 'product',
    keywords: ['Thermal', 'streaming', 'Shorts', 'monetization', 'chat velocity'],
    angle: 'Explain the 30-second heat spike → Short conversion demo',
    cta: 'Try Thermal at cutline-industries.studio',
  },
  {
    id: 'live-unlock',
    title: 'Streamers: unlock clean 4K clips live for $15 while chat is popping',
    pillar: 'streamers',
    keywords: ['streamers', 'Discord', 'clip unlock', 'Valorant', 'Twitch'],
    angle: 'Tier 1 live unlock — Discord delivery while still live',
    cta: 'Add Thermal Bot to Discord',
  },
  {
    id: 'bounty-board',
    title: 'The Bounty Board: fans claim heat clips while creators sleep',
    pillar: 'streamers',
    keywords: ['bounty board', 'Shorts', 'community', 'clips', 'Stripe'],
    angle: 'Tier 2 self-serve bundles on the public bounty grid',
    cta: 'Browse bounties at cutline-industries.studio/bounty',
  },
  {
    id: 'indie-retainer',
    title: 'Developers: retainer packs that ship weekly creative',
    pillar: 'indie-devs',
    keywords: ['retainers', 'wishlist', 'TikTok ads', 'creator marketing'],
    angle: 'Tier 3 $750–$2,500/mo retainer for wishlist-driving ad cuts',
    cta: 'Book a retainer at cutline-industries.studio/developers',
  },
  {
    id: 'cutline-engine',
    title: 'Cutline API + FFmpeg: the engine inside the OS',
    pillar: 'behind-the-build',
    keywords: ['Cutline', 'FFmpeg', 'Autopilot', 'API', 'clip factory'],
    angle: 'How the open OS tools power clip cutting at scale',
    cta: 'Explore the OS at cutline-industries.studio/os',
  },
  {
    id: 'heat-detection',
    title: 'What is chat velocity and why it predicts viral clips',
    pillar: 'product',
    keywords: ['heat detection', 'msg/min', 'viral clips', 'streaming analytics'],
    angle: 'Messages-per-minute spikes as the signal for clip-worthy moments',
    cta: 'See the heat feed on cutline-industries.studio',
  },
  {
    id: 'monetize-streams',
    title: '3 ways creators monetize heat without going viral',
    pillar: 'streamers',
    keywords: ['creator income', 'clip revenue', 'clips', 'monetization'],
    angle: 'Live unlock, bounty bundles, and owned distribution as a stack',
    cta: 'Start at cutline-industries.studio',
  },
  {
    id: 'wishlist-ads',
    title: 'One creator moment beats a $5k ad spend',
    pillar: 'indie-devs',
    keywords: ['wishlist', 'creator marketing', 'ad packs'],
    angle: 'Side-by-side raw source vs AI-captioned ad cut case study',
    cta: 'Developers: cutline-industries.studio/developers',
  },
]

export type AudienceInput = {
  id: string
  message: string
  source: 'site' | 'api' | 'youtube-comment'
  at: string
}

export type FeedbackInsight = {
  videoId: string
  title: string
  views: number
  likes: number
  comments: number
  score: number
  topComment?: string
}

export type FeedbackReport = {
  generated_at: string
  insights: FeedbackInsight[]
  winning_hooks: string[]
  winning_keywords: string[]
  audience_requests: string[]
  next_topic_suggestions: string[]
}
