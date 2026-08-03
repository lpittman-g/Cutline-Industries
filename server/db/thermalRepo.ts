import type {
  BountyPlatform,
  BountyPostWithClip,
  ClipRow,
  HeatSpikeRow,
  HeatSpikeStatus,
  RetainerRow,
  RetainerStatus,
  SaleRow,
  SaleTier,
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

export async function updateStreamerVelocity(
  id: number,
  mpm: number,
  isLive: boolean,
  game?: string | null,
) {
  await getPool().query(
    `UPDATE streamers
     SET current_msg_per_min = $2,
         is_live = $3,
         avg_chat_velocity = GREATEST(avg_chat_velocity, $2),
         game = COALESCE($4, game)
     WHERE id = $1`,
    [id, mpm, isLive, game?.trim() || null],
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

export async function updateClipAutopilot(input: {
  clipId: number
  status: 'processing' | 'completed' | 'failed'
  caption?: string
  discordMessage?: string
  devEmailSubject?: string
  devEmailBody?: string
  error?: string | null
}) {
  await getPool().query(
    `UPDATE clips SET
       autopilot_status = $2,
       ai_caption = COALESCE($3, ai_caption),
       ai_discord_message = COALESCE($4, ai_discord_message),
       ai_dev_email_subject = COALESCE($5, ai_dev_email_subject),
       ai_dev_email_body = COALESCE($6, ai_dev_email_body),
       autopilot_error = $7,
       autopilot_completed_at =
         CASE WHEN $2 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP
              ELSE autopilot_completed_at END
     WHERE id = $1`,
    [
      input.clipId,
      input.status,
      input.caption ?? null,
      input.discordMessage ?? null,
      input.devEmailSubject ?? null,
      input.devEmailBody ?? null,
      input.error ?? null,
    ],
  )
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

export async function getClipById(id: number): Promise<ClipWithMeta | null> {
  const res = await getPool().query(`SELECT * FROM clips WHERE id = $1`, [id])
  return res.rows[0] ? mapClip(res.rows[0]) : null
}

export async function listBountyClips(limit = 50): Promise<ClipWithMeta[]> {
  const res = await getPool().query(
    `SELECT DISTINCT c.*, 'bounty' AS tier, 50.00::numeric AS price_usd
     FROM clips c
     INNER JOIN bounty_posts bp ON bp.clip_id = c.id
     WHERE c.media_url IS NOT NULL AND bp.status = 'posted'
     ORDER BY bp.posted_at DESC NULLS LAST, c.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapClip)
}

function mapBountyPost(row: Record<string, unknown>): BountyPostWithClip {
  return row as unknown as BountyPostWithClip
}

export async function listBountyPosts(limit = 100): Promise<BountyPostWithClip[]> {
  const res = await getPool().query(
    `SELECT bp.*,
            c.title AS clip_title,
            c.streamer_username,
            c.game,
            c.thumbnail_url,
            c.media_url,
            c.status AS clip_status,
            c.duration_sec
     FROM bounty_posts bp
     JOIN clips c ON c.id = bp.clip_id
     ORDER BY bp.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapBountyPost)
}

export async function getBountyPost(id: number): Promise<BountyPostWithClip | null> {
  const res = await getPool().query(
    `SELECT bp.*,
            c.title AS clip_title,
            c.streamer_username,
            c.game,
            c.thumbnail_url,
            c.media_url,
            c.status AS clip_status,
            c.duration_sec
     FROM bounty_posts bp
     JOIN clips c ON c.id = bp.clip_id
     WHERE bp.id = $1`,
    [id],
  )
  return res.rows[0] ? mapBountyPost(res.rows[0]) : null
}

export async function queueBountyPost(input: {
  clip_id: number
  platform: BountyPlatform
  notes?: string
}): Promise<BountyPostWithClip> {
  const res = await getPool().query(
    `INSERT INTO bounty_posts (clip_id, platform, status, notes)
     VALUES ($1, $2, 'queued', $3)
     ON CONFLICT (clip_id, platform) DO UPDATE SET
       status = 'queued',
       notes = COALESCE(EXCLUDED.notes, bounty_posts.notes),
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [input.clip_id, input.platform, input.notes ?? null],
  )
  const id = res.rows[0].id as number
  const post = await getBountyPost(id)
  if (!post) throw new Error('Failed to create bounty post')
  return post
}

export async function markBountyPosted(input: {
  id: number
  post_url: string
  posted_at?: Date
  views?: number
  engagement?: number
  notes?: string
}): Promise<BountyPostWithClip> {
  await getPool().query(
    `UPDATE bounty_posts SET
       post_url = $2,
       status = 'posted',
       posted_at = COALESCE($3, CURRENT_TIMESTAMP),
       views = COALESCE($4, views),
       engagement = COALESCE($5, engagement),
       notes = COALESCE($6, notes),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      input.id,
      input.post_url,
      input.posted_at ?? null,
      input.views ?? null,
      input.engagement ?? null,
      input.notes ?? null,
    ],
  )
  const post = await getBountyPost(input.id)
  if (!post) throw new Error('Bounty post not found')
  return post
}

export async function updateBountyMetrics(input: {
  id: number
  views?: number
  engagement?: number
}): Promise<BountyPostWithClip> {
  await getPool().query(
    `UPDATE bounty_posts SET
       views = COALESCE($2, views),
       engagement = COALESCE($3, engagement),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [input.id, input.views ?? null, input.engagement ?? null],
  )
  const post = await getBountyPost(input.id)
  if (!post) throw new Error('Bounty post not found')
  return post
}

export async function countQueuedBountyPosts(): Promise<number> {
  const res = await getPool().query(
    `SELECT COUNT(*)::int AS n FROM bounty_posts WHERE status = 'queued'`,
  )
  return res.rows[0]?.n ?? 0
}

export async function setClipCheckoutSession(clipId: number, sessionId: string) {
  await getPool().query(
    `UPDATE clips SET stripe_checkout_session_id = $2 WHERE id = $1`,
    [clipId, sessionId],
  )
}

export async function claimClip(input: {
  clipId: number
  saleAmountCents: number
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string | null
  buyerEmail?: string | null
}) {
  await withClient(async (client) => {
    await client.query(
      `UPDATE clips
       SET status = 'claimed',
           sale_amount_cents = $2,
           claimed_at = CURRENT_TIMESTAMP,
           stripe_checkout_session_id = $3
       WHERE id = $1`,
      [input.clipId, input.saleAmountCents, input.stripeCheckoutSessionId],
    )
    await client.query(
      `UPDATE sales
       SET status = 'completed',
           stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
           buyer_email = COALESCE($3, buyer_email),
           completed_at = CURRENT_TIMESTAMP
       WHERE stripe_checkout_session_id = $1`,
      [input.stripeCheckoutSessionId, input.stripePaymentIntentId ?? null, input.buyerEmail ?? null],
    )
  })
}

function mapSale(row: Record<string, unknown>): SaleRow {
  return row as unknown as SaleRow
}

export async function insertPendingSale(input: {
  clip_id: number | null
  tier: SaleTier
  amount_cents: number
  stripe_checkout_session_id: string
  metadata?: Record<string, unknown>
}): Promise<SaleRow> {
  const res = await getPool().query(
    `INSERT INTO sales (clip_id, tier, amount_cents, stripe_checkout_session_id, status, metadata)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING *`,
    [
      input.clip_id,
      input.tier,
      input.amount_cents,
      input.stripe_checkout_session_id,
      JSON.stringify(input.metadata ?? {}),
    ],
  )
  return mapSale(res.rows[0])
}

function mapRetainer(row: Record<string, unknown>): RetainerRow {
  return row as unknown as RetainerRow
}

const RETAINER_STATUSES: RetainerStatus[] = ['prospect', 'sample_sent', 'active', 'cancelled']

export function isRetainerStatus(value: string): value is RetainerStatus {
  return RETAINER_STATUSES.includes(value as RetainerStatus)
}

export async function listRetainers(limit = 100): Promise<RetainerRow[]> {
  const res = await getPool().query(
    `SELECT * FROM retainers ORDER BY created_at DESC NULLS LAST, id DESC LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapRetainer)
}

export async function findRetainerByGameTitle(gameTitle: string): Promise<RetainerRow | null> {
  const res = await getPool().query(
    `SELECT * FROM retainers
     WHERE LOWER(game_title) = LOWER($1)
       AND contact_email IS NOT NULL
       AND status <> 'cancelled'
     ORDER BY
       CASE status WHEN 'prospect' THEN 1 WHEN 'sample_sent' THEN 2 ELSE 3 END,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [gameTitle],
  )
  return res.rows[0] ? mapRetainer(res.rows[0]) : null
}

export async function getRetainerById(id: number): Promise<RetainerRow | null> {
  const res = await getPool().query(`SELECT * FROM retainers WHERE id = $1`, [id])
  return res.rows[0] ? mapRetainer(res.rows[0]) : null
}

export async function insertRetainer(input: {
  dev_name: string
  game_title: string
  monthly_mrr?: number
  contact_email?: string | null
  notes?: string | null
  sample_clip_id?: number | null
  status?: RetainerStatus
}): Promise<RetainerRow> {
  const res = await getPool().query(
    `INSERT INTO retainers (
       dev_name, game_title, monthly_mrr, contact_email, notes, sample_clip_id, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.dev_name,
      input.game_title,
      input.monthly_mrr ?? 750,
      input.contact_email ?? null,
      input.notes ?? null,
      input.sample_clip_id ?? null,
      input.status ?? 'prospect',
    ],
  )
  return mapRetainer(res.rows[0])
}

export async function updateRetainer(
  id: number,
  input: {
    status?: RetainerStatus
    monthly_mrr?: number
    contact_email?: string | null
    notes?: string | null
    sample_clip_id?: number | null
    stripe_subscription_id?: string | null
    stripe_checkout_session_id?: string | null
    dev_name?: string
    game_title?: string
  },
): Promise<RetainerRow | null> {
  const res = await getPool().query(
    `UPDATE retainers SET
       status = COALESCE($2, status),
       monthly_mrr = COALESCE($3, monthly_mrr),
       contact_email = COALESCE($4, contact_email),
       notes = COALESCE($5, notes),
       sample_clip_id = COALESCE($6, sample_clip_id),
       stripe_subscription_id = COALESCE($7, stripe_subscription_id),
       stripe_checkout_session_id = COALESCE($8, stripe_checkout_session_id),
       dev_name = COALESCE($9, dev_name),
       game_title = COALESCE($10, game_title),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.status ?? null,
      input.monthly_mrr ?? null,
      input.contact_email === undefined ? null : input.contact_email,
      input.notes === undefined ? null : input.notes,
      input.sample_clip_id === undefined ? null : input.sample_clip_id,
      input.stripe_subscription_id === undefined ? null : input.stripe_subscription_id,
      input.stripe_checkout_session_id === undefined ? null : input.stripe_checkout_session_id,
      input.dev_name ?? null,
      input.game_title ?? null,
    ],
  )
  return res.rows[0] ? mapRetainer(res.rows[0]) : null
}

export async function setRetainerCheckoutSession(retainerId: number, sessionId: string) {
  await getPool().query(
    `UPDATE retainers
     SET stripe_checkout_session_id = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [retainerId, sessionId],
  )
}

export async function activateRetainer(input: {
  retainerId: number
  stripeCheckoutSessionId: string
  stripeSubscriptionId?: string | null
  saleAmountCents: number
  buyerEmail?: string | null
}) {
  await withClient(async (client) => {
    await client.query(
      `UPDATE retainers
       SET status = 'active',
           stripe_subscription_id = COALESCE($2, stripe_subscription_id),
           stripe_checkout_session_id = $3,
           contact_email = COALESCE($4, contact_email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        input.retainerId,
        input.stripeSubscriptionId ?? null,
        input.stripeCheckoutSessionId,
        input.buyerEmail ?? null,
      ],
    )
    await client.query(
      `UPDATE sales
       SET status = 'completed',
           buyer_email = COALESCE($2, buyer_email),
           completed_at = CURRENT_TIMESTAMP
       WHERE stripe_checkout_session_id = $1`,
      [input.stripeCheckoutSessionId, input.buyerEmail ?? null],
    )
  })
}

export async function retainerPipelineCounts(): Promise<{ status: RetainerStatus; count: number }[]> {
  const res = await getPool().query(
    `SELECT status, COUNT(*)::int AS count FROM retainers GROUP BY status`,
  )
  const byStatus = new Map<string, number>(
    res.rows.map((row) => [String(row.status), Number(row.count)]),
  )
  return RETAINER_STATUSES.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }))
}

export async function countPendingRetainerOutreaches(): Promise<number> {
  const res = await getPool().query(
    `SELECT COUNT(*)::int AS n FROM retainers WHERE status IN ('prospect', 'sample_sent')`,
  )
  return res.rows[0]?.n ?? 0
}

export async function seedRetainersIfEmpty() {
  const count = await getPool().query(`SELECT COUNT(*)::int AS n FROM retainers`)
  if ((count.rows[0]?.n ?? 0) > 0) return

  const seeds: Array<{
    dev_name: string
    game_title: string
    status: RetainerStatus
    monthly_mrr: number
    contact_email: string
    notes: string
  }> = [
    {
      dev_name: 'Northbark Games',
      game_title: 'Hollow Paths',
      status: 'sample_sent',
      monthly_mrr: 750,
      contact_email: 'northbark@example.com',
      notes: 'High-heat variety coverage — sample ad pack sent',
    },
    {
      dev_name: 'Arc Byte',
      game_title: 'Neon Circuit',
      status: 'prospect',
      monthly_mrr: 1250,
      contact_email: 'arcbyte@example.com',
      notes: 'Detected in heat window — awaiting pitch',
    },
    {
      dev_name: 'Saltpixel',
      game_title: 'Tideforge',
      status: 'active',
      monthly_mrr: 2000,
      contact_email: 'saltpixel@example.com',
      notes: 'Monthly TikTok/Shorts wishlist pack',
    },
  ]

  for (const s of seeds) {
    await insertRetainer(s)
  }
}

export async function listSales(limit = 100): Promise<SaleRow[]> {
  const res = await getPool().query(
    `SELECT s.*, c.title AS clip_title, c.streamer_username
     FROM sales s
     LEFT JOIN clips c ON c.id = s.clip_id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return res.rows.map(mapSale)
}

export async function totalRevenueCents(): Promise<number> {
  const res = await getPool().query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS total FROM sales WHERE status = 'completed'`,
  )
  return res.rows[0]?.total ?? 0
}

export async function revenueByTier(): Promise<Record<SaleTier, number>> {
  const res = await getPool().query(
    `SELECT tier, COALESCE(SUM(amount_cents), 0)::int AS total
     FROM sales WHERE status = 'completed'
     GROUP BY tier`,
  )
  const out: Record<SaleTier, number> = { gateway: 0, bounty: 0, retainer: 0 }
  for (const row of res.rows) {
    const tier = row.tier as SaleTier
    if (tier in out) out[tier] = row.total
  }
  return out
}

export type RevenueTimelinePoint = { date: string; amountCents: number; tier: SaleTier }

export async function revenueTimeline(days = 30): Promise<RevenueTimelinePoint[]> {
  const res = await getPool().query(
    `SELECT DATE(completed_at) AS day, tier, COALESCE(SUM(amount_cents), 0)::int AS total
     FROM sales
     WHERE status = 'completed' AND completed_at >= CURRENT_DATE - $1::int
     GROUP BY day, tier
     ORDER BY day ASC`,
    [days],
  )
  return res.rows.map((row) => ({
    date: String(row.day).slice(0, 10),
    amountCents: row.total,
    tier: row.tier as SaleTier,
  }))
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
