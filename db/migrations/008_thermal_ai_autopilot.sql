-- AI enrichment state for heat → copy → distribution → dev pitch

ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_caption TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_discord_message TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_dev_email_subject TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_dev_email_body TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS autopilot_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE clips ADD COLUMN IF NOT EXISTS autopilot_error TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS autopilot_completed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_clips_autopilot_status ON clips(autopilot_status);
