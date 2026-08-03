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

export type RevenueTimelinePoint = {
  date: string
  amountCents: number
  tier: string
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
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

export function fetchClips() {
  return getJson<{ clips: ThermalClip[] }>('/api/clips')
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
  return postJson<{ ok: boolean; clipId?: number; status?: string }>('/api/checkout/confirm', {
    sessionId,
  })
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API}${path}`
}

export function formatUsd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function tierPriceLabel(tier: string) {
  if (tier === 'bounty') return '$50 Bounty'
  return '$15 Gateway'
}
