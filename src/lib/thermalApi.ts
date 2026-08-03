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
  if (!res.ok) throw new Error(await res.text())
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

export function triggerHeatSpike(streamerId: number) {
  return postJson<{ ok: boolean; clip?: ThermalClip }>('/api/heat-events', { streamerId })
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API}${path}`
}
