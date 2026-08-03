import { triggerHeatEvent } from './heatPipeline.ts'
import {
  listStreamers,
  seedStreamersIfEmpty,
  updateStreamerVelocity,
  upsertStreamer,
} from './db/thermalRepo.ts'
import { thermalDbEnabled } from './db/pool.ts'
import { ROOT } from './youtubeAuth.ts'
import path from 'node:path'

const HEAT_THRESHOLD = Number(process.env.THERMAL_HEAT_THRESHOLD || 120)
const POLL_MS = Number(process.env.THERMAL_TWITCH_POLL_MS || 30_000)

let timer: ReturnType<typeof setInterval> | null = null
let appAccessToken: string | null = null
let tokenExpiresAt = 0

async function getAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim()
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  if (appAccessToken && Date.now() < tokenExpiresAt - 60_000) return appAccessToken

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' },
  )
  if (!res.ok) return null
  const json = (await res.json()) as { access_token: string; expires_in: number }
  appAccessToken = json.access_token
  tokenExpiresAt = Date.now() + json.expires_in * 1000
  return appAccessToken
}

async function fetchTwitchLiveMap(): Promise<Map<string, { viewer_count: number; game_name: string; title: string }>> {
  const token = await getAppAccessToken()
  const clientId = process.env.TWITCH_CLIENT_ID?.trim()
  if (!token || !clientId) return new Map()

  const streamers = await listStreamers()
  const logins = streamers.map((s) => s.username).filter(Boolean)
  if (!logins.length) return new Map()

  const params = new URLSearchParams()
  for (const login of logins) params.append('user_login', login)

  const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) return new Map()

  const json = (await res.json()) as {
    data: { user_login: string; viewer_count: number; game_name: string; title: string }[]
  }
  const map = new Map<string, { viewer_count: number; game_name: string; title: string }>()
  for (const row of json.data) {
    map.set(row.user_login.toLowerCase(), {
      viewer_count: row.viewer_count,
      game_name: row.game_name,
      title: row.title,
    })
  }
  return map
}

function estimateMpm(viewerCount: number, prevMpm: number, isLive: boolean) {
  if (!isLive) return Math.max(0, Math.floor(prevMpm * 0.2))
  const base = Math.floor(viewerCount / 8) + 20
  const jitter = Math.floor(Math.random() * 25)
  return Math.max(base + jitter, prevMpm > 0 ? prevMpm - 5 : 0)
}

async function pollOnce() {
  if (!thermalDbEnabled()) return

  const defaultVod = path.join(ROOT, 'inbox', 'cutline_test_vod.mp4')
  await seedStreamersIfEmpty(defaultVod)

  const liveMap = await fetchTwitchLiveMap()
  const credentialed = Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET)
  const streamers = await listStreamers()

  for (const s of streamers) {
    const live = liveMap.get(s.username.toLowerCase())
    const isLive = credentialed ? Boolean(live) : s.is_live
    const mpm = credentialed && live
      ? estimateMpm(live.viewer_count, s.current_msg_per_min, true)
      : simulateMpm(s)

    await updateStreamerVelocity(s.id, mpm, isLive)

    if (isLive && mpm >= HEAT_THRESHOLD) {
      const cooldownKey = `heat-${s.id}`
      if (recentHeatCooldown.has(cooldownKey)) continue
      recentHeatCooldown.add(cooldownKey)
      setTimeout(() => recentHeatCooldown.delete(cooldownKey), 120_000)

      await triggerHeatEvent({
        streamerId: s.id,
        msgPerMin: mpm,
        title: live?.title ? `Heat: ${live.title.slice(0, 80)}` : undefined,
      }).catch((err) => console.error('[thermal-monitor]', err))
    }
  }
}

const recentHeatCooldown = new Set<string>()

function simulateMpm(s: { is_live: boolean; current_msg_per_min: number }) {
  if (!s.is_live) return Math.max(5, Math.floor(Math.random() * 15))
  const drift = Math.floor(Math.random() * 40) - 10
  return Math.max(40, s.current_msg_per_min + drift)
}

export function startTwitchMonitor() {
  if (!thermalDbEnabled()) {
    console.log('[thermal-monitor] DATABASE_URL not set — monitor disabled')
    return
  }
  if (timer) return
  console.log(`[thermal-monitor] started (threshold=${HEAT_THRESHOLD} mpm, poll=${POLL_MS}ms)`)
  pollOnce().catch(console.error)
  timer = setInterval(() => pollOnce().catch(console.error), POLL_MS)
}

export function stopTwitchMonitor() {
  if (timer) clearInterval(timer)
  timer = null
}

export async function syncStreamersFromTwitch() {
  const token = await getAppAccessToken()
  const clientId = process.env.TWITCH_CLIENT_ID?.trim()
  if (!token || !clientId) return { mode: 'seed-only' }

  const streamers = await listStreamers()
  for (const s of streamers) {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(s.username)}`, {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) continue
    const json = (await res.json()) as { data: { id: string; login: string; profile_image_url: string }[] }
    const user = json.data[0]
    if (!user) continue
    await upsertStreamer({
      twitch_id: user.id,
      username: user.login,
      profile_image_url: user.profile_image_url,
      is_live: s.is_live,
      current_msg_per_min: s.current_msg_per_min,
      game: s.game,
    })
  }
  return { mode: 'twitch-synced' }
}
