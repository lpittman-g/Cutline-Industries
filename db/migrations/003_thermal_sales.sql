-- Thermal sales ledger + clip claim fields (Stripe Checkout step 2)

CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    clip_id INT REFERENCES clips(id),
    tier VARCHAR(50) NOT NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    stripe_checkout_session_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    buyer_email VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

ALTER TABLE clips ADD COLUMN IF NOT EXISTS sale_amount_cents INT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sales_clip_id ON sales(clip_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_stripe_checkout ON clips(stripe_checkout_session_id);
