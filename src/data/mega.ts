export type ModuleStatus = 'live' | 'beta' | 'next'

export interface PlatformModule {
  id: string
  name: string
  blurb: string
  path: string
  status: ModuleStatus
  group: 'create' | 'grow' | 'money' | 'ops'
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'command',
    name: 'Command Center',
    blurb: 'One screen for content, outreach, money, and Autopilot health.',
    path: '/command',
    status: 'live',
    group: 'ops',
  },
  {
    id: 'studio',
    name: 'Studio',
    blurb: 'Mark clutch moments, score clips, generate gaming-native copy.',
    path: '/studio',
    status: 'live',
    group: 'create',
  },
  {
    id: 'autopilot',
    name: 'Autopilot',
    blurb: 'Inbox → cut Shorts → upload to YouTube without babysitting.',
    path: '/autopilot',
    status: 'live',
    group: 'create',
  },
  {
    id: 'packs',
    name: 'Pack Factory',
    blurb: 'Turn one VOD into 10–30 Shorts ready for a posting week.',
    path: '/packs',
    status: 'live',
    group: 'create',
  },
  {
    id: 'outreach',
    name: 'Outreach Engine',
    blurb: '4-week buyer machine for brands, agencies, and creators.',
    path: '/outreach',
    status: 'live',
    group: 'grow',
  },
  {
    id: 'ads',
    name: 'Ads Lab',
    blurb: 'Headlines, descriptions, and creative packs for Google Ads.',
    path: '/ads',
    status: 'live',
    group: 'grow',
  },
  {
    id: 'monetize',
    name: 'Money Stack',
    blurb: 'Every YouTube + off-platform revenue rail in one map.',
    path: '/monetize',
    status: 'live',
    group: 'money',
  },
  {
    id: 'deals',
    name: 'Deal Desk',
    blurb: 'Sponsor packages, retainers, invoices, close pipeline.',
    path: '/deals',
    status: 'live',
    group: 'money',
  },
  {
    id: 'analytics',
    name: 'Pulse Analytics',
    blurb: 'RPM, CTR, retention, outreach reply rate, deal velocity.',
    path: '/analytics',
    status: 'live',
    group: 'ops',
  },
  {
    id: 'mediakit',
    name: 'Media Kit',
    blurb: 'Instant sponsor-ready kit from channel proof + rate card.',
    path: '/media-kit',
    status: 'live',
    group: 'grow',
  },
  {
    id: 'export',
    name: 'Export Bay',
    blurb: 'JSON, CSV, FFmpeg scripts, YouTube draft packs.',
    path: '/export',
    status: 'live',
    group: 'create',
  },
  {
    id: 'playbook',
    name: 'Playbook',
    blurb: 'Operating rules for growth, YPP, and always-on posting.',
    path: '/playbook',
    status: 'live',
    group: 'ops',
  },
]

export interface Lead {
  id: string
  name: string
  company: string
  title: string
  niche: string
  score: number
  stage: 'new' | 'contacted' | 'replied' | 'call' | 'won' | 'lost'
  notes: string
}

export const DEMO_LEADS: Lead[] = [
  {
    id: 'l1',
    name: 'Ava Chen',
    company: 'Nova Controllers',
    title: 'Partnerships Lead',
    niche: 'Gaming hardware',
    score: 92,
    stage: 'call',
    notes: 'Wants 12 Shorts pack around new pad launch.',
  },
  {
    id: 'l2',
    name: 'Marcus Reed',
    company: 'RankFuel',
    title: 'Influencer Marketing',
    niche: 'Creator tools',
    score: 88,
    stage: 'replied',
    notes: 'Asked for media kit + CPM expectations.',
  },
  {
    id: 'l3',
    name: 'Priya Shah',
    company: 'PixelArena Esports',
    title: 'Brand Manager',
    niche: 'Esports',
    score: 84,
    stage: 'contacted',
    notes: 'Tournament week — needs fast turn clips.',
  },
  {
    id: 'l4',
    name: 'Jonah Blake',
    company: 'Hydra Energy',
    title: 'Growth Manager',
    niche: 'Beverage',
    score: 79,
    stage: 'new',
    notes: 'Cold list — gaming lifestyle fit.',
  },
  {
    id: 'l5',
    name: 'Elena Ortiz',
    company: 'ClipHouse Agency',
    title: 'Talent Partnerships',
    niche: 'Agency',
    score: 90,
    stage: 'won',
    notes: 'Retainer for weekly Shorts for 3 creators.',
  },
]

export interface DealPackage {
  id: string
  name: string
  price: string
  includes: string[]
}

export const DEAL_PACKAGES: DealPackage[] = [
  {
    id: 'spark',
    name: 'Spark Pack',
    price: '$750',
    includes: ['10 Shorts', 'Titles + hooks', '72h delivery', '1 revision'],
  },
  {
    id: 'surge',
    name: 'Surge Retainer',
    price: '$2,500/mo',
    includes: ['40 Shorts / month', 'Weekly strategy', 'Priority Autopilot', 'Monthly report'],
  },
  {
    id: 'eclipse',
    name: 'Eclipse Integration',
    price: '$5,000+',
    includes: ['Sponsored longform + Shorts', 'Custom CTA kit', 'Usage rights', 'Whitelisting add-on'],
  },
]

export const MONEY_RAILS = [
  { id: 'ads', name: 'YouTube Ad Revenue', type: 'YPP', status: 'Core' },
  { id: 'shorts-ads', name: 'Shorts Ad Revenue', type: 'YPP', status: 'Core' },
  { id: 'premium', name: 'YouTube Premium Share', type: 'YPP', status: 'Core' },
  { id: 'members', name: 'Channel Memberships', type: 'YPP', status: 'Fan' },
  { id: 'super', name: 'Super Chat / Stickers / Thanks', type: 'YPP', status: 'Fan' },
  { id: 'shop', name: 'Shopping / Merch Shelf', type: 'YPP', status: 'Commerce' },
  { id: 'brandconnect', name: 'BrandConnect', type: 'YPP', status: 'Brand' },
  { id: 'sponsors', name: 'Direct Sponsorships', type: 'Off-platform', status: 'Brand' },
  { id: 'affiliate', name: 'Affiliate Links', type: 'Off-platform', status: 'Commerce' },
  { id: 'products', name: 'Digital Products (Stripe)', type: 'Off-platform', status: 'Product' },
  { id: 'retainers', name: 'Clip Retainers for Creators', type: 'B2B', status: 'Service' },
  { id: 'licensing', name: 'Clip Licensing', type: 'B2B', status: 'Service' },
]

export const ADS_HEADLINES = [
  'Cutline Industries',
  'Gaming Content Studio',
  'YouTube Shorts Autopilot',
  'Cut VODs Into Shorts',
  'Ship Shorts Faster',
  'Grow Your Gaming Channel',
  'Shorts Built To Convert',
  'Gaming Content, Cut Fast',
]

export const ADS_DESCRIPTIONS = [
  'Turn gaming VODs into Shorts fast. Cutline helps you post, grow, and monetize.',
  'Cutline Industries cuts gameplay into Shorts and longform ready for YouTube ads.',
  'From VOD to Shorts on Autopilot. Built for gaming creators who need volume.',
  'Gaming media studio for YouTube growth—Shorts, packs, and monetization tools.',
]

export const MEGA_NORTH_STAR = {
  brand: 'Cutline Industries',
  domain: 'cutline-industries.studio',
  promise: 'The Creator Operating System for gaming media — content, distribution, outreach, and money in one machine.',
  tagline: 'Gaming content, cut to ship.',
}
