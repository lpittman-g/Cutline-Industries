export type PipelineStage =
  | 'discover'
  | 'script'
  | 'voice'
  | 'visuals'
  | 'process'
  | 'publish'
  | 'monetize'

export interface PipelineStep {
  id: string
  stage: PipelineStage
  title: string
  owner: 'AI' | 'Replit' | 'AWS' | 'YouTube' | 'AdSense' | 'Cutline'
  detail: string
  outputs: string[]
}

/** Four-layer stack from the Cutline content engine brief. */
export const STACK_PILLARS = [
  {
    id: 'ai',
    name: '1. AI stack',
    role: 'Content creation & automation engine',
    bullets: [
      'Script & concepting — ideas, title hooks, SEO keywords, full gaming scripts',
      'Voiceovers & audio — AI TTS when not recording live',
      'Visual assets — thumbnails, channel art, B-roll via image models',
    ],
  },
  {
    id: 'replit',
    name: '2. Replit',
    role: 'Rapid prototyping & workflow automation',
    bullets: [
      'YouTube API workers — trending videos, views, keyword performance',
      'Auto descriptions, tags, chapters, social promo posts',
      'Discord/Telegram bots + webhooks for news and publish schedules',
    ],
  },
  {
    id: 'aws',
    name: '3. AWS',
    role: 'Scalable backend & cloud storage',
    bullets: [
      'S3 — raw footage, thumbs, audio, exports',
      'Lambda / EC2 — headless FFmpeg and Autopilot jobs',
      'DynamoDB / RDS — pipeline status + analytics logs',
    ],
  },
  {
    id: 'adsense',
    name: '4. AdSense & monetization',
    role: 'Convert traffic into cash',
    bullets: [
      'YPP — 1k subs + 4k watch hours or 10M Short views',
      'Companion guides/blog with AdSense on cutline-industries.studio',
      'Stripe packs remain near-term cash while YPP ramps',
    ],
  },
] as const

export const CONTENT_PIPELINE: PipelineStep[] = [
  {
    id: 'p1',
    stage: 'discover',
    title: 'Trend radar',
    owner: 'Replit',
    detail:
      'Python/Node workers (`scripts/replit/trend_radar.py`) scan gaming news, Reddit, and YouTube API for rising topics, keywords, and competitor gaps.',
    outputs: ['topic queue', 'SEO keyword list', 'trend score'],
  },
  {
    id: 'p2',
    stage: 'script',
    title: 'Script & concepting',
    owner: 'AI',
    detail:
      'Generate video ideas, title hooks, SEO keywords, and full 8–10 minute scripts tailored to trending gaming topics/tutorials.',
    outputs: ['script.md', 'titles[]', 'hooks[]', 'chapters[]'],
  },
  {
    id: 'p3',
    stage: 'voice',
    title: 'Voiceovers & audio',
    owner: 'AI',
    detail:
      'Optional AI TTS for natural voiceovers when not recording live commentary; normalize loudness and export WAV/MP3.',
    outputs: ['voiceover.wav', 'caption draft'],
  },
  {
    id: 'p4',
    stage: 'visuals',
    title: 'Visual assets',
    owner: 'AI',
    detail:
      'Thumbnail concepts, channel art, B-roll stills/animations via image models; store approved variants.',
    outputs: ['thumbnails/', 'broll/', 'channel-art/'],
  },
  {
    id: 'p5',
    stage: 'process',
    title: 'Render & storage',
    owner: 'AWS',
    detail:
      'S3 stores raw + exports. Lambda/EC2 runs FFmpeg cuts, vertical Shorts, and packaging without local GPU dependency. DynamoDB/RDS track job status.',
    outputs: ['s3://cutline-media/...', 'shorts_out/', 'manifest.json'],
  },
  {
    id: 'p6',
    stage: 'publish',
    title: 'Publish automation',
    owner: 'YouTube',
    detail:
      'Cutline Autopilot + Replit scripts upload on schedule, set metadata/tags/chapters, notify Discord/Telegram.',
    outputs: ['YouTube video IDs', 'Shorts URLs', 'publish log'],
  },
  {
    id: 'p7',
    stage: 'monetize',
    title: 'Monetization layer',
    owner: 'AdSense',
    detail:
      'YPP ad revenue on YouTube (1k subs + 4k hours or 10M Short views) + companion guides/blog AdSense on cutline-industries.studio for search traffic.',
    outputs: ['AdSense earnings', 'YPP RPM', 'affiliate/sponsor CTAs'],
  },
]

export interface TrendTopic {
  id: string
  title: string
  source: string
  score: number
  keywords: string[]
  angle: string
}

export const DEMO_TRENDS: TrendTopic[] = [
  {
    id: 't1',
    title: 'Rank reset survival guide',
    source: 'YouTube API + Reddit r/competitive',
    score: 91,
    keywords: ['rank reset', 'placement matches', 'climb tips'],
    angle: '8-min tutorial + 12 Shorts cutdowns',
  },
  {
    id: 't2',
    title: 'Patch notes that break the meta',
    source: 'Patch feed scraper',
    score: 87,
    keywords: ['patch notes', 'buffs', 'nerfs', 'new meta'],
    angle: 'News explainer with loadout Shorts',
  },
  {
    id: 't3',
    title: 'One habit that separates diamond from immortal',
    source: 'Competitor gap scan',
    score: 84,
    keywords: ['crosshair placement', 'utility', 'game sense'],
    angle: 'Coach-style longform + silent clip Shorts',
  },
]

export const EXECUTION_LOOP = [
  {
    step: 1,
    title: 'Pipeline creation (Replit)',
    text: 'Build/run trend scanners for subreddits, news feeds, and YouTube API keyword performance.',
  },
  {
    step: 2,
    title: 'Content generation (AI)',
    text: 'Turn topics into 8–10 minute scripts, titles, hooks, thumbnail prompts, and optional TTS.',
  },
  {
    step: 3,
    title: 'Asset management (AWS)',
    text: 'Park raw footage, audio, thumbs, and exports in S3; process with Lambda/EC2 FFmpeg jobs.',
  },
  {
    step: 4,
    title: 'Publish & monetize (YouTube + AdSense)',
    text: 'Schedule uploads, optimize metadata, monetize via YPP and companion site AdSense.',
  },
]
