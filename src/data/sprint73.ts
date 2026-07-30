export interface SprintBlock {
  id: string
  hours: string
  title: string
  cashTarget: string
  tasks: string[]
}

/** Aggressive 73-hour Cutline cash sprint (cash first, YPP second). */
export const SPRINT_73H: SprintBlock[] = [
  {
    id: 'h0-8',
    hours: 'Hours 0–8',
    title: 'Open the cash pipes',
    cashTarget: 'Infrastructure for money in',
    tasks: [
      'Stripe: create Pay Links for Spark Pack ($750) and Surge Retainer ($2,500/mo)',
      'Put both links on Media Kit + Deal Desk + site CTAs',
      'AdSense: add cutline-industries.studio, copy real ads.txt, submit for review',
      'YouTube: finish Autopilot refresh_token (or schedule manual Shorts upload today)',
      'Redeploy latest Cutline OS build to AWS Amplify',
    ],
  },
  {
    id: 'h8-24',
    hours: 'Hours 8–24',
    title: 'Ship content + first outreach wave',
    cashTarget: 'Traffic + first buyer conversations',
    tasks: [
      'Cut/publish 15–25 Shorts (Autopilot or Studio) — public, niche-tight',
      'Publish 1 longform or “compilation + CTA” video pointing to site/pay link',
      'Outreach Engine: send 30 value-first messages with free sample + Spark Pack link',
      'Post 1 LinkedIn/X/Discord blast with media kit + pay link',
      'Blog: publish 1 AdSense-ready guide from /blog topics',
    ],
  },
  {
    id: 'h24-48',
    hours: 'Hours 24–48',
    title: 'Follow-ups + close pressure',
    cashTarget: 'First paid yes or booked call',
    tasks: [
      'Follow up every unreplied outreach (day-2 bump with a new clip angle)',
      'Book calls with anyone who replied; send rate card same hour',
      'Ship another 15 Shorts; pin comment with Spark Pack / subscribe CTA',
      'If AdSense approved: turn on display units (VITE_ADSENSE_* + redeploy)',
      'Offer 48-hour “launch discount” on Spark Pack to hot leads only',
    ],
  },
  {
    id: 'h48-73',
    hours: 'Hours 48–73',
    title: 'Collect + lock recurring',
    cashTarget: 'Cash collected or retainer signed',
    tasks: [
      'Close at least one Spark Pack or deposit via Stripe',
      'Push Surge Retainer to the warmest lead (payment plan OK)',
      'Deliver fast if paid — speed builds testimonials',
      'Set Autopilot daily Shorts schedule for the next 14 days',
      'Write the week-2 money scoreboard: cash in, calls booked, Shorts live, AdSense status',
    ],
  },
]

export const SPRINT_TARGETS = [
  { label: 'Cash in (Stripe)', value: '$750–$2,500+' },
  { label: 'Shorts published', value: '30–40' },
  { label: 'Outreaches sent', value: '50+' },
  { label: 'Calls booked', value: '3+' },
  { label: 'AdSense', value: 'Site submitted / live' },
]
