-- Add dedicated TOTP secret column.
-- mfa_secret continues to hold the one-time recovery code.
-- mfa_totp_secret holds the base32 TOTP seed scanned into the authenticator app.

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_totp_secret TEXT;
