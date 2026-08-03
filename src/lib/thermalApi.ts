const API = import.meta.env.VITE_API_URL || ''

export type ThermalStreamer = {
  id: number
  username: string
  game: string
  is_live: boolean
  current_msg_per_min: number
}

export type ThermalClip = {
  id: number
  title: string | null
  duration_sec: number | null
  game: string | null
  streamer_username: string | null
  thumbnail_url: string | null
  media_url: string | null
  status: string
  tier: string
  price_usd?: string
  sale_amount_cents?: number | null
  ai_caption?: string | null
  ai_tiktok_caption?: string | null
  autopilot_status?: string | null
  autopilot_error?: string | null
}

export type DashboardSummary = {
  heatAlert: {
    msgPerMin: number
    streamer: string
    spikeId: number
    status: string
  } | null
  activeLiveChannels: number
  dailyClipsRendered: number
  totalRevenueCents: number
  pendingOutreaches: number
  stripeMode?: string
}

export type MissionControlStatus = {
  generatedAt: string
  summary: {
    implemented: number
    ready: number
    total: number
  }
  phases: {
    id: string
    name: string
    status: 'ready' | 'needs_config'
    implemented: boolean
    description: string
    checks: {
      label: string
      ready: boolean
      required: boolean
    }[]
  }[]
  nextActions: {
    phaseId: string
    label: string
    detail: string
  }[]
  repositories: {
    id: string
    owner: string
    name: string
    defaultBranch: string
    href: string
    automationCount: number
  }[]
  automationSummary: {
    running: number
    attention: number
    ready: number
    external: number
  }
  automationGroups: {
    id: string
    label: string
    agents: {
      id: string
      name: string
      repositoryId: string
      status: 'running' | 'ready' | 'attention' | 'external'
      summary: string
      run: {
        mode: string
        progress: number | null
        progressState: 'determinate' | 'indeterminate' | 'external'
        currentStep: string
        lastRunAt: string | null
        hasError: boolean
      }
      artifacts: {
        label: string
        href: string
        count: number | null
      }[]
      launch: {
        label: string
        href: string
        external: boolean
      }
    }[]
  }[]
  links: {
    id: string
    label: string
    href: string
    kind: 'github' | 'cursor'
  }[]
}

export type ThermalSale = {
  id: number
  clip_id: number | null
  tier: string
  amount_cents: number
  status: string
  buyer_email: string | null
  created_at: string
  completed_at: string | null
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = await res.text()
    try {
      const parsed = JSON.parse(message) as { error?: string }
      message = parsed.error ?? message
    } catch {
      /* keep raw */
    }
    throw new Error(message || res.statusText)
  }
  return res.json() as Promise<T>
}

export type ThermalBountyPost = {
  id: number
  clip_id: number
  platform: string
  post_url: string | null
  status: string
  views: number
  engagement: number
  posted_at: string | null
  notes: string | null
  clip_title: string | null
  streamer_username: string | null
  game: string | null
  thumbnail_url: string | null
  media_url: string | null
  clip_status: string
  duration_sec: number | null
}

export type RevenueTimelinePoint = {
  date: string
  amountCents: number
  tier: string
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = await res.text()
    try {
      const parsed = JSON.parse(message) as { error?: string; hint?: string }
      message = [parsed.error, parsed.hint].filter(Boolean).join(' — ')
    } catch {
      /* keep raw */
    }
    throw new Error(message || res.statusText)
  }
  return res.json() as Promise<T>
}

export function fetchStreamers() {
  return getJson<{ streamers: ThermalStreamer[] }>('/api/streamers')
}

export function fetchDashboardSummary() {
  return getJson<DashboardSummary>('/api/dashboard/summary')
}

export function fetchMissionControlStatus() {
  return getJson<MissionControlStatus>('/api/mission-control/status')
}

export function fetchClips() {
  return getJson<{ clips: ThermalClip[] }>('/api/clips')
}

export function fetchBountyPosts() {
  return getJson<{ posts: ThermalBountyPost[] }>('/api/bounty-posts')
}

export function queueBountyPost(clipId: number, platform: 'x' | 'tiktok', notes?: string) {
  return postJson<{ ok: boolean; post: ThermalBountyPost }>('/api/bounty-posts', {
    clipId,
    platform,
    notes,
  })
}

export function markBountyPosted(
  postId: number,
  input: { postUrl: string; views?: number; engagement?: number; notes?: string },
) {
  return postJson<{ ok: boolean; post: ThermalBountyPost }>(
    `/api/bounty-posts/${postId}/mark-posted`,
    input,
  )
}

export function updateBountyMetrics(postId: number, input: { views?: number; engagement?: number }) {
  return patchJson<{ ok: boolean; post: ThermalBountyPost }>(`/api/bounty-posts/${postId}`, input)
}

export function fetchBountyClips() {
  return getJson<{ clips: ThermalClip[] }>('/api/bounty/clips')
}

export function fetchClip(id: number) {
  return getJson<{ clip: ThermalClip }>(`/api/clips/${id}`)
}

export function fetchSales() {
  return getJson<{ sales: ThermalSale[]; stripeMode?: string }>('/api/sales')
}

export function fetchRevenueTimeline(days = 30) {
  return getJson<{ timeline: RevenueTimelinePoint[]; byTier: Record<string, number> }>(
    `/api/dashboard/revenue-timeline?days=${days}`,
  )
}

export function triggerHeatSpike(streamerId: number) {
  return postJson<{ ok: boolean; clip?: ThermalClip }>('/api/heat-events', { streamerId })
}

export function createCheckoutSession(clipId: number, tier?: string) {
  return postJson<{ ok: boolean; url: string; tier: string; amountCents: number }>(
    '/api/checkout/session',
    { clipId, tier },
  )
}

export function confirmCheckoutSession(sessionId: string) {
  return postJson<{
    ok: boolean
    clipId?: number
    retainerId?: number
    tier?: string
    status?: string
  }>('/api/checkout/confirm', {
    sessionId,
  })
}

export function fetchClipDownload(clipId: number, sessionId: string) {
  return postJson<{
    ok: boolean
    url: string
    storage: 's3' | 'local'
    expiresIn?: number
    captions?: {
      social: string | null
      x: string | null
      tiktok: string | null
      discord: string | null
    }
  }>(`/api/clips/${clipId}/download`, { sessionId })
}

export function rerunClipAutopilot(clipId: number) {
  return postJson<{ ok: boolean; clip: ThermalClip | null }>(`/api/clips/${clipId}/autopilot`, {})
}

export type ThermalRetainerStatus = 'prospect' | 'sample_sent' | 'active' | 'cancelled'

export type ThermalRetainer = {
  id: number
  dev_name: string
  game_title: string
  stripe_subscription_id: string | null
  monthly_mrr: string
  status: ThermalRetainerStatus | string
  contact_email?: string | null
  notes?: string | null
  sample_clip_id?: number | null
  stripe_checkout_session_id?: string | null
  created_at?: string
  updated_at?: string
}

export type ThermalPipelineCount = {
  status: ThermalRetainerStatus | string
  count: number
}

export function fetchDevelopers() {
  return getJson<{ developers: ThermalRetainer[] }>('/api/developers')
}

export function fetchDeveloperPipeline() {
  return getJson<{ pipeline: ThermalPipelineCount[] }>('/api/developers/pipeline')
}

export function createDeveloper(input: {
  devName: string
  gameTitle: string
  monthlyMrr?: number
  contactEmail?: string
  notes?: string
  sampleClipId?: number
  status?: ThermalRetainerStatus
}) {
  return postJson<{ ok: boolean; developer: ThermalRetainer }>('/api/developers', input)
}

export function updateDeveloper(
  id: number,
  input: {
    status?: ThermalRetainerStatus
    monthlyMrr?: number
    contactEmail?: string | null
    notes?: string | null
    sampleClipId?: number | null
    devName?: string
    gameTitle?: string
  },
) {
  return patchJson<{ ok: boolean; developer: ThermalRetainer }>(`/api/developers/${id}`, input)
}

export function createRetainerCheckout(id: number, monthlyMrr?: number) {
  return postJson<{ ok: boolean; url: string; tier: string; amountCents: number }>(
    `/api/developers/${id}/checkout`,
    monthlyMrr != null ? { monthlyMrr } : {},
  )
}

export function startPublicRetainerCheckout(input: {
  devName: string
  gameTitle: string
  monthlyMrr?: number
  contactEmail?: string
  notes?: string
}) {
  return postJson<{
    ok: boolean
    url: string
    tier: string
    amountCents: number
    developer: ThermalRetainer
  }>('/api/developers/checkout', input)
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API}${path}`
}

export function formatUsd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatMrr(usd: string | number) {
  const n = typeof usd === 'string' ? Number(usd) : usd
  if (!Number.isFinite(n)) return String(usd)
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`
}

export function tierPriceLabel(tier: string) {
  if (tier === 'bounty') return '$50 Bounty'
  if (tier === 'retainer') return '$750+ Retainer'
  return '$15 Gateway'
}

export function retainerStatusLabel(status: string) {
  if (status === 'prospect') return 'Lead Identified'
  if (status === 'sample_sent') return 'Sample Sent'
  if (status === 'active') return 'Retainer Closed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}
