-- Cutline Links — internal link shortener + click analytics
-- Replaces dub.sh entirely; runs inside the Artemis network.

CREATE TABLE IF NOT EXISTS links (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT NOT NULL UNIQUE,          -- e.g. "abc123" → cutline.gg/abc123
  destination TEXT NOT NULL,                 -- full target URL
  title       TEXT NOT NULL DEFAULT '',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  project_id  TEXT,                          -- optional: tie to a Thermal project
  clip_id     TEXT,                          -- optional: tie to a Thermal clip
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  archived    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id          BIGSERIAL PRIMARY KEY,
  link_id     TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  country     TEXT,
  city        TEXT,
  device      TEXT,   -- desktop | mobile | tablet | bot
  browser     TEXT,
  os          TEXT,
  referer     TEXT,
  ip_hash     TEXT    -- sha256 of IP — never store raw IP
);

CREATE INDEX IF NOT EXISTS link_clicks_link_id_idx ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS link_clicks_clicked_at_idx ON link_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS links_slug_idx ON links(slug);
CREATE INDEX IF NOT EXISTS links_project_id_idx ON links(project_id);
