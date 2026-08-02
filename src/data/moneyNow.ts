export type MoneyActionStatus = 'todo' | 'doing' | 'done' | 'blocked'

export interface MoneyAction {
  id: string
  title: string
  platform: 'AdSense' | 'YouTube' | 'AWS' | 'Replit' | 'Stripe' | 'AI' | 'Cutline'
  impact: 'high' | 'medium'
  eta: string
  steps: string[]
  status: MoneyActionStatus
}

export const MONEY_NOW_ACTIONS: MoneyAction[] = [
  {
    id: 'adsense-site',
    title: 'Turn on AdSense on cutline-industries.studio',
    platform: 'AdSense',
    impact: 'high',
    eta: 'Today',
    status: 'todo',
    steps: [
      'In AdSense, add site: cutline-industries.studio',
      'Get ads.txt lines from AdSense and publish at https://cutline-industries.studio/ads.txt',
      'Place display units on Landing + Money + Media Kit pages (above-the-fold + in-content)',
      'Submit site for review and keep content indexing clean',
    ],
  },
  {
    id: 'yt-ypp',
    title: 'Point Autopilot at YouTube money rails',
    platform: 'YouTube',
    impact: 'high',
    eta: 'Today–this week',
    status: 'doing',
    steps: [
      'OAuth refresh_token saved — channel Lamont Pittman is connected',
      'Rename channel to Cutline Industries in YouTube Studio',
      'Post Shorts daily from inbox VODs (private first, then public schedule)',
      'Push toward YPP thresholds (subs + watch hours / Shorts views)',
      'When eligible: enable ads, Shorts ads, memberships, Super Thanks, Shopping',
    ],
  },
  {
    id: 'aws-edge',
    title: 'Use AWS as the always-on money edge',
    platform: 'AWS',
    impact: 'high',
    eta: 'This week',
    status: 'doing',
    steps: [
      'Keep Amplify hosting production on cutline-industries.studio',
      'Redeploy latest Creator OS build (Command, Money, Outreach, Ads Lab)',
      'Run Autopilot worker on a small EC2/Lightsail box watching inbox/',
      'Store YouTube token in Secrets Manager (not in chat)',
    ],
  },
  {
    id: 'replit-workers',
    title: 'Use Replit for fast money bots & landing experiments',
    platform: 'Replit',
    impact: 'medium',
    eta: 'This week',
    status: 'todo',
    steps: [
      'Host a sponsor intake form that posts to Discord/email',
      'Run a simple lead-capture microsite for Spark Pack ($750)',
      'Auto-DM/email follow-up sequences for outreach replies',
      'Prototype GPT copy workers that fill Ads Lab + outreach templates',
    ],
  },
  {
    id: 'ai-factory',
    title: 'Use GPT as the copy/sales factory',
    platform: 'AI',
    impact: 'high',
    eta: 'Today',
    status: 'todo',
    steps: [
      'Generate 20 outreach variants per niche (hardware, esports, beverage)',
      'Generate weekly Shorts title batches inside Studio copy engine',
      'Generate sponsor one-pagers from Media Kit module',
      'Generate AdSense-compliant site articles that support display ads',
    ],
  },
  {
    id: 'stripe-close',
    title: 'Close first cash with Stripe, not wait on YPP',
    platform: 'Stripe',
    impact: 'high',
    eta: 'This week',
    status: 'todo',
    steps: [
      'Activate Stripe pay link for Spark Pack ($750)',
      'Activate Surge Retainer ($2,500/mo) link',
      'Put links on Media Kit + Deal Desk + site CTA',
      'Send 20 personalized outreaches with pay-link CTA',
    ],
  },
  {
    id: 'cutline-os',
    title: 'Operate daily from Cutline Command Center',
    platform: 'Cutline',
    impact: 'high',
    eta: 'Daily',
    status: 'doing',
    steps: [
      'Morning: Autopilot/Studio ship Shorts',
      'Midday: Outreach Engine 10 leads',
      'Evening: Deal Desk follow-ups',
      'Weekly: Ads Lab + Money Stack review',
    ],
  },
]

export const ADSENSE_PAGE_SLOTS = [
  { id: 'home-top', page: 'Landing', placement: 'Below hero CTA' },
  { id: 'money-incontent', page: 'Money Stack', placement: 'Between rails grid and collection map' },
  { id: 'kit-bottom', page: 'Media Kit', placement: 'Below packages' },
  { id: 'command-side', page: 'Command', placement: 'After today\'s machine card' },
]
