-- Persist TikTok bounty caption on clips for paid download fulfillment.
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_tiktok_caption TEXT;
