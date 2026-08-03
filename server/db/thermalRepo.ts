import type {
  ClipRow,
  HeatSpikeRow,
  HeatSpikeStatus,
  StreamerRow,
} from './thermalTypes.ts'
import { getPool, withClient } from './pool.ts'

export type StreamerWithVelocity = StreamerRow & {
  game: string
  current_msg_per_min: number
  profile_image_url: string | null
  vod_fallback_url: string | null
}

export type ClipWithMeta = ClipRow & {
  title: string | null
  duration_sec: number | null
  game: string | null
  streamer_username: string | null
  thumbnail_url: string | null
  media_url: string | null
  tier: string
}

export type HeatEventWithStreamer = HeatSpikeRow & {
  title: string | null
  game: string | null
  streamer_username?: string
  streamer?: StreamerWithVelocity
}

function mapStreamer(row: Record<string, unknown>): StreamerWithVelocity {
  return row as unknown as StreamerWithVelocity
}

function mapClip(row: Record<string, unknown>): ClipWithMeta {
  return row as unknown as ClipWithMeta
}

function mapHeat(row: Record<string, unknown>): HeatEventWithStreamer {
  return row as unknown as HeatEventWithStreamer
}

export async function listStreamers(): Promise<StreamerWithVelocity[]> {
  const res = await getPool().query(
    `SELECT * FROM streamers ORDER BY is_live DESC, username ASC`,
  )
  return res.rows.map(mapStreamer)
}

export async function getStreamerById(id: number): Promise<StreamerWithVelocity | null> {
  const res = await getPool().query(`SELECT * FROM streamers WHERE id = $1`, [id])
  return res.rows[0] ? mapStreamer(res.rows[0]) : null
}

export async function getStreamerByUsername(username: string): Promise<StreamerWithVelocity | null> {
  const res = await getPool().query(`SELECT * FROM streamers WHERE username = $1`, [username])
  return res.rows[0] ? mapStreamer(res.rows[0]) : null
}

export async function upsertStreamer(input: {
  twitch_id: string
  username: string
  game?: string
  is_live?: boolean
  current_msg_per_min?: number
  profile_image_url?: string | null
  vod_fallback_url?: string | null
}): Promise<StreamerWithVelocity> {
  const res = await getPool().query(
    `INSERT INTO streamers (twitch_id, username, game, is_live, current_msg_per_min, profile_image_url, vod_fallback_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (twitch_id) DO UPDATE SET
       username = EXCLUDED.username,
       game = COALESCE(EXCLUDED.game, streamers.game),
       is_live = EXCLUDED.is_live,
       current_msg_per_min = EXCLUDED.current_msg_per_min,
       profile_image_url = COALESCE(EXCLUDED.profile_image_url, streamers.profile_image_url),
       vod_fallback_url = COALESCE(EXCLUDED.vod_fallback_url, streamers.vod_fallback_url)
     RETURNING *`,
    [
      input.twitch_id,
      input.username,
      input.game ?? '',
      input.is_live ?? false,
      input.current_msg_per_min ?? 0,
      input.profile_image_url ?? null,
      input.vod_fallback_url ?? null,
    ],
  )
  return mapStreamer(res.rows[0])
}

export async function updateStreamerVelocity(id: number, mpm: number, isLive: boolean) {
  await getPool().query(
    `UPDATE streamers SET current_msg_per_min = $2, is_live = $3, avg_chat_velocity = GREATEST(avg_chat_velocity, $2) WHERE id = $1`,
    [id, mpm, isLive],
  )
}

export async function insertHeatSpike(input: {
  streamer_id: number
  msg_per_min: number
  timestamp_start?: Date
  vod_url?: string | null
  title?: string
  game?: string
}): Promise<HeatEventWithStreamer> {
  const res = await getPool().query(
    `INSERT INTO heat_spikes (streamer_id, msg_per_min, timestamp_start, vod_url, status, title, game)
     VALUES ($1, $2, $3, $4, 'detected', $5, $6)
     RETURNING *`,
    [
      input.streamer_id,
      input.msg_per_min,
      input.timestamp_start ?? new Date(),
      input.vod_url ?? null,
      input.title ?? null,
      input.game ?? null,
    ],
  )
  return mapHeat(res.rows[0])
}

export async function updateHeatSpikeStatus(id: number, status: HeatSpikeStatus) {
  await getPool().query(
    `UPDATE heat_spikes SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id, status],
  )
}

export async function getHeatSpike(id: number): Promise<HeatEventWithStreamer | null> {
  const res = await getPool().query(
    `SELECT h.*, s.username AS streamer_username
     FROM heat_spikes h
     LEFT JOIN streamers s ON s.id = h.streamer_id
     WHERE h.id = $1`,
    [id],
  )
  return res.rows[0] ? mapHeat(res.rows[0]) : null
}

export async function listHeatEvents(limit = 50): Promise<HeatEventWithStreamer[]> {
  const res = await getPool().query(
    `SELECT h.*, s.username AS streamer_username, s.game AS streamer_game
     FROM heat_spikes h
     LEFT JOIN streamers s ON s.id = h.streamer_id
     ORDER BY h.created_at DESC NULLS LAST, h.id DESC
     LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapHeat)
}

export async function listRecentHeatAlert(): Promise<HeatEventWithStreamer | null> {
  const res = await getPool().query(
    `SELECT h.*, s.username AS streamer_username
     FROM heat_spikes h
     LEFT JOIN streamers s ON s.id = h.streamer_id
     ORDER BY h.created_at DESC NULLS LAST, h.id DESC
     LIMIT 1`,
  )
  return res.rows[0] ? mapHeat(res.rows[0]) : null
}

export async function insertClip(input: {
  spike_id: number
  title: string
  duration_sec: number
  game: string
  streamer_username: string
  thumbnail_url: string
  media_url: string
  s3_watermarked_url?: string
  s3_clean_url?: string
  tier?: string
  price_usd?: number
}): Promise<ClipWithMeta> {
  const res = await getPool().query(
    `INSERT INTO clips (
      spike_id, title, duration_sec, game, streamer_username,
      thumbnail_url, media_url, s3_watermarked_url, s3_clean_url,
      tier, price_usd, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unclaimed')
    RETURNING *`,
    [
      input.spike_id,
      input.title,
      input.duration_sec,
      input.game,
      input.streamer_username,
      input.thumbnail_url,
      input.media_url,
      input.s3_watermarked_url ?? input.media_url,
      input.s3_clean_url ?? input.media_url,
      input.tier ?? 'gateway',
      input.price_usd ?? 15,
    ],
  )
  return mapClip(res.rows[0])
}

export async function listClips(limit = 100): Promise<ClipWithMeta[]> {
  const res = await getPool().query(
    `SELECT * FROM clips ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapClip)
}

export async function listTopClips(limit = 10): Promise<ClipWithMeta[]> {
  const res = await getPool().query(
    `SELECT * FROM clips WHERE media_url IS NOT NULL ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapClip)
}

export async function countClipsToday(): Promise<number> {
  const res = await getPool().query(
    `SELECT COUNT(*)::int AS n FROM clips WHERE created_at >= CURRENT_DATE`,
  )
  return res.rows[0]?.n ?? 0
}

export async function countLiveStreamers(): Promise<number> {
  const res = await getPool().query(`SELECT COUNT(*)::int AS n FROM streamers WHERE is_live = true`)
  return res.rows[0]?.n ?? 0
}

export async function seedStreamersIfEmpty(defaultVod?: string) {
  const count = await getPool().query(`SELECT COUNT(*)::int AS n FROM streamers`)
  if ((count.rows[0]?.n ?? 0) > 0) return

  const seeds = [
    { twitch_id: '1001', username: 'nova_fps', game: 'Valorant', is_live: true, mpm: 186 },
    { twitch_id: '1002', username: 'pixelrift', game: 'Elden Ring', is_live: true, mpm: 142 },
    { twitch_id: '1003', username: 'cozyqueue', game: 'Hollow Paths', is_live: false, mpm: 12 },
    { twitch_id: '1004', username: 'aimlab_lex', game: 'Apex Legends', is_live: true, mpm: 128 },
  ]

  for (const s of seeds) {
    await upsertStreamer({
      twitch_id: s.twitch_id,
      username: s.username,
      game: s.game,
      is_live: s.is_live,
      current_msg_per_min: s.mpm,
      vod_fallback_url: defaultVod ?? null,
    })
  }
}
