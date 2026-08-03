-- Auth roles for Mission Control access

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Bootstrap: elevate matching email if set at migrate time is env-driven in app;
-- keep a safe default index for role lookups.
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
