export type HeatSpikeStatus = 'detected' | 'processing' | 'rendered' | 'failed'
export type ClipStatus = 'unclaimed' | 'claimed'
export type RetainerStatus = 'prospect' | 'sample_sent' | 'active' | 'cancelled'

export type StreamerRow = {
  id: number
  twitch_id: string
  username: string
  is_live: boolean
  avg_chat_velocity: number
  created_at: string
  game?: string
  current_msg_per_min?: number
  profile_image_url?: string | null
  vod_fallback_url?: string | null
}

export type HeatSpikeRow = {
  id: number
  streamer_id: number | null
  msg_per_min: number
  timestamp_start: string
  vod_url: string | null
  status: HeatSpikeStatus
  title?: string | null
  game?: string | null
  created_at?: string
  updated_at?: string
}

export type ClipRow = {
  id: number
  spike_id: number | null
  s3_clean_url: string | null
  s3_watermarked_url: string | null
  stripe_payment_link: string | null
  price_usd: string
  status: ClipStatus
  created_at: string
  title?: string | null
  duration_sec?: number | null
  game?: string | null
  streamer_username?: string | null
  thumbnail_url?: string | null
  media_url?: string | null
  tier?: string
  sale_amount_cents?: number | null
  claimed_at?: string | null
  stripe_checkout_session_id?: string | null
  ai_caption?: string | null
  ai_tiktok_caption?: string | null
  ai_discord_message?: string | null
  ai_dev_email_subject?: string | null
  ai_dev_email_body?: string | null
  autopilot_status?: string | null
  autopilot_error?: string | null
  autopilot_completed_at?: string | null
}

export type SaleStatus = 'pending' | 'completed' | 'refunded' | 'failed'
export type SaleTier = 'gateway' | 'bounty' | 'retainer'

export type SaleRow = {
  id: number
  clip_id: number | null
  tier: SaleTier
  amount_cents: number
  currency: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  status: SaleStatus
  buyer_email: string | null
  metadata: Record<string, unknown>
  created_at: string
  completed_at: string | null
}

export type RetainerRow = {
  id: number
  dev_name: string
  game_title: string
  stripe_subscription_id: string | null
  monthly_mrr: string
  status: RetainerStatus
  contact_email?: string | null
  notes?: string | null
  sample_clip_id?: number | null
  stripe_checkout_session_id?: string | null
  created_at?: string
  updated_at?: string
}

export type BountyPlatform = 'x' | 'tiktok'
export type BountyPostStatus = 'queued' | 'posted' | 'failed'

export type BountyPostRow = {
  id: number
  clip_id: number
  platform: BountyPlatform
  post_url: string | null
  status: BountyPostStatus
  views: number
  engagement: number
  posted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type BountyPostWithClip = BountyPostRow & {
  clip_title: string | null
  streamer_username: string | null
  game: string | null
  thumbnail_url: string | null
  media_url: string | null
  clip_status: string
  duration_sec: number | null
}

export const THERMAL_TABLES = ['streamers', 'heat_spikes', 'clips', 'retainers', 'sales', 'bounty_posts'] as const
