-- Bounty distribution: social posts linked to clips

CREATE TABLE IF NOT EXISTS bounty_posts (
    id SERIAL PRIMARY KEY,
    clip_id INT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    post_url TEXT,
    status VARCHAR(50) DEFAULT 'queued',
    views INT DEFAULT 0,
    engagement INT DEFAULT 0,
    posted_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bounty_posts_clip_id ON bounty_posts(clip_id);
CREATE INDEX IF NOT EXISTS idx_bounty_posts_status ON bounty_posts(status);
CREATE INDEX IF NOT EXISTS idx_bounty_posts_platform ON bounty_posts(platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bounty_posts_clip_platform ON bounty_posts(clip_id, platform);
