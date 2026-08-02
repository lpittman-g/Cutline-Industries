-- Thermal Core Schema
-- Source: product blueprint (streamers → heat_spikes → clips → retainers)

CREATE TABLE IF NOT EXISTS streamers (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    is_live BOOLEAN DEFAULT false,
    avg_chat_velocity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS heat_spikes (
    id SERIAL PRIMARY KEY,
    streamer_id INT REFERENCES streamers(id),
    msg_per_min INT NOT NULL,
    timestamp_start TIMESTAMP NOT NULL,
    vod_url TEXT,
    status VARCHAR(50) DEFAULT 'detected' -- 'detected', 'processing', 'rendered', 'failed'
);

CREATE TABLE IF NOT EXISTS clips (
    id SERIAL PRIMARY KEY,
    spike_id INT REFERENCES heat_spikes(id),
    s3_clean_url TEXT,
    s3_watermarked_url TEXT,
    stripe_payment_link TEXT,
    price_usd DECIMAL(10,2) DEFAULT 15.00,
    status VARCHAR(50) DEFAULT 'unclaimed', -- 'unclaimed', 'claimed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retainers (
    id SERIAL PRIMARY KEY,
    dev_name VARCHAR(255) NOT NULL,
    game_title VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255),
    monthly_mrr DECIMAL(10,2) DEFAULT 750.00,
    status VARCHAR(50) DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_heat_spikes_streamer_id ON heat_spikes(streamer_id);
CREATE INDEX IF NOT EXISTS idx_heat_spikes_status ON heat_spikes(status);
CREATE INDEX IF NOT EXISTS idx_clips_spike_id ON clips(spike_id);
CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);
CREATE INDEX IF NOT EXISTS idx_retainers_status ON retainers(status);
