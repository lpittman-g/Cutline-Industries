export type BlueprintPhaseId = 'p0' | 'p1' | 'p2' | 'p3' | 'p4'
export type BlueprintItemStatus = 'done' | 'now' | 'next' | 'blocked'

export interface BlueprintPhase {
  id: BlueprintPhaseId
  name: string
  goal: string
  status: BlueprintItemStatus
  items: string[]
}

export interface BlueprintPillar {
  id: 'create' | 'grow' | 'money' | 'ops'
  name: string
  job: string
  modules: string[]
}

export interface BlueprintAction {
  id: string
  title: string
  owner: 'you' | 'autopilot' | 'both'
  eta: string
  status: BlueprintItemStatus
}

export const BLUEPRINT_MISSION =
  'Gaming VOD → Shorts factory → audience → cash. Stripe first, YPP second. Use Google, AWS, Replit, and GPT as leverage — never as competitors.'

export const BLUEPRINT_PILLARS: BlueprintPillar[] = [
  {
    id: 'create',
    name: 'Create',
    job: 'Inbox VODs → cut → title → upload',
    modules: ['Studio', 'Packs', 'Autopilot', 'Pipeline'],
  },
  {
    id: 'grow',
    name: 'Grow',
    job: 'Reach buyers and viewers',
    modules: ['Outreach', 'Ads Lab', 'Media Kit', 'Blog'],
  },
  {
    id: 'money',
    name: 'Money',
    job: 'Cash this week + YPP later',
    modules: ['Money Now', 'Deals', 'Monetize', 'Stripe', 'AdSense'],
  },
  {
    id: 'ops',
    name: 'Ops',
    job: 'Run the machine daily',
    modules: ['Command', 'Blueprint', 'Playbook', 'Analytics', '73h Sprint'],
  },
]

export const BLUEPRINT_PHASES: BlueprintPhase[] = [
  {
    id: 'p0',
    name: 'Phase 0 — Foundation',
    goal: 'Brand, OS, YouTube auth, channel online',
    status: 'now',
    items: [
      'Creator OS shell live',
      'GA + AdSense client wired',
      'YouTube OAuth refresh token saved',
      'Channel live (rename to Cutline Industries)',
      'Restore studio domain → Amplify',
      'Restore GitHub main + ship PRs',
    ],
  },
  {
    id: 'p1',
    name: 'Phase 1 — Ship daily',
    goal: '3–10 Shorts/day via Autopilot',
    status: 'now',
    items: [
      'Drop VODs in inbox/',
      'Flip CUTLINE_DRY_RUN=0 for real uploads',
      'Private → public schedule',
      'Cross-post TikTok + Reels when capacity allows',
    ],
  },
  {
    id: 'p2',
    name: 'Phase 2 — Money this week',
    goal: 'First Stripe cash + AdSense + outreach',
    status: 'next',
    items: [
      'Stripe links: Spark $750 + Surge $2,500',
      '20 personalized outreaches / day',
      'Media Kit + Deal Desk CTAs with pay links',
      'AdSense live on production domain',
      '2–3 Blog guides published',
    ],
  },
  {
    id: 'p3',
    name: 'Phase 3 — YPP track',
    goal: 'Partner thresholds → ads rails',
    status: 'next',
    items: [
      'Shorts views + subs toward YPP',
      'Enable ads / memberships / Shopping when eligible',
      'Keep Stripe/sponsors as primary cash until YPP stabilizes',
    ],
  },
  {
    id: 'p4',
    name: 'Phase 4 — Scale',
    goal: 'Always-on worker + multi-channel + agency',
    status: 'next',
    items: [
      'EC2/Lightsail Autopilot 24/7',
      'Discord community layer',
      'Multi-channel cross-post automation',
      'Client seats / portals',
    ],
  },
]

export const BLUEPRINT_CADENCE = [
  { window: 'Morning', action: 'Ship Shorts from Autopilot / Studio', module: 'Autopilot' },
  { window: 'Midday', action: 'Send 10–20 outreaches', module: 'Outreach' },
  { window: 'Afternoon', action: 'Deal follow-ups + Media Kit sends', module: 'Deals' },
  { window: 'Evening', action: 'Pulse views, replies, leads', module: 'Analytics' },
  { window: 'Weekly', action: 'Ads Lab creatives + Money Stack review', module: 'Ads Lab' },
]

export const BLUEPRINT_OFFERS = [
  {
    id: 'spark',
    name: 'Spark Pack',
    price: '$750',
    promise: '10 Shorts, titles/hooks, 72h, 1 revision',
  },
  {
    id: 'surge',
    name: 'Surge Retainer',
    price: '$2,500/mo',
    promise: '40 Shorts/mo, weekly strategy, priority Autopilot',
  },
  {
    id: 'eclipse',
    name: 'Eclipse Integration',
    price: '$5,000+',
    promise: 'Sponsored longform + Shorts, CTA kit, usage rights',
  },
]

export const BLUEPRINT_NEXT_ACTIONS: BlueprintAction[] = [
  {
    id: 'rename-channel',
    title: 'Rename YouTube channel → Cutline Industries',
    owner: 'you',
    eta: 'Today',
    status: 'now',
  },
  {
    id: 'first-vod',
    title: 'Drop first VOD in inbox/ and run Autopilot once (private)',
    owner: 'both',
    eta: 'Today',
    status: 'now',
  },
  {
    id: 'stripe-links',
    title: 'Create Stripe pay links for Spark + Surge',
    owner: 'you',
    eta: 'Today',
    status: 'now',
  },
  {
    id: 'outreach-20',
    title: 'Send 20 outreaches with Media Kit + pay link',
    owner: 'you',
    eta: 'Today',
    status: 'next',
  },
  {
    id: 'dns-amplify',
    title: 'Point cutline-industries.studio DNS at Amplify (Route 53 NS)',
    owner: 'you',
    eta: 'This week',
    status: 'blocked',
  },
  {
    id: 'github-main',
    title: 'Restore GitHub main + push blueprint/API branches',
    owner: 'both',
    eta: 'This week',
    status: 'blocked',
  },
  {
    id: 'adsense-slot',
    title: 'Add VITE_ADSENSE_SLOT and redeploy',
    owner: 'both',
    eta: 'This week',
    status: 'next',
  },
]

export const BLUEPRINT_METRICS = [
  { metric: 'Shorts published', d7: '21+', d30: '90+' },
  { metric: 'Outreaches sent', d7: '100+', d30: '400+' },
  { metric: 'Qualified replies', d7: '5+', d30: '20+' },
  { metric: 'Cash closed (Stripe)', d7: '$750+', d30: '$2,500+' },
  { metric: 'Channel subs', d7: '50+', d30: '500+' },
]
