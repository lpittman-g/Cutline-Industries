export type HeatSpikeStatus = 'detected' | 'processing' | 'rendered' | 'failed'
export type ClipStatus = 'unclaimed' | 'claimed'
export type RetainerStatus = 'active' | 'paused' | 'canceled'

export type StreamerRow = {
  id: number
  twitch_id: string
  username: string
  is_live: boolean
  avg_chat_velocity: number
  created_at: string
}

export type HeatSpikeRow = {
  id: number
  streamer_id: number | null
  msg_per_min: number
  timestamp_start: string
  vod_url: string | null
  status: HeatSpikeStatus
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
}

export type RetainerRow = {
  id: number
  dev_name: string
  game_title: string
  stripe_subscription_id: string | null
  monthly_mrr: string
  status: RetainerStatus
}

export const THERMAL_TABLES = ['streamers', 'heat_spikes', 'clips', 'retainers'] as const
