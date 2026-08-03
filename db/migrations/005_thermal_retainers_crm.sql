-- Thermal Tier 3: Indie Dev CRM columns + pipeline statuses on retainers

ALTER TABLE retainers ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS sample_clip_id INT REFERENCES clips(id);
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255);
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Normalize legacy statuses → pipeline statuses
UPDATE retainers SET status = 'cancelled' WHERE status IN ('canceled', 'paused');
UPDATE retainers SET status = 'prospect' WHERE status IS NULL OR status = '';

ALTER TABLE retainers ALTER COLUMN status SET DEFAULT 'prospect';

CREATE INDEX IF NOT EXISTS idx_retainers_stripe_checkout ON retainers(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_retainers_created_at ON retainers(created_at DESC);
