import { getPool } from '../db/pool.ts'

export type UserRole = 'user' | 'operator' | 'admin'

export type UserRow = {
  id: number
  email: string
  password_hash: string
  display_name: string | null
  email_verified: boolean
  mfa_enabled: boolean
  mfa_secret: string | null
  failed_login_count: number
  locked_until: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export type PublicUser = {
  id: number
  email: string
  displayName: string | null
  emailVerified: boolean
  mfaEnabled: boolean
  role: UserRole
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: row.email_verified,
    mfaEnabled: row.mfa_enabled,
    role: (row.role as UserRole) || 'user',
  }
}

function mapUser(row: Record<string, unknown>): UserRow {
  return row as unknown as UserRow
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const res = await getPool().query(`SELECT * FROM users WHERE email = $1`, [email])
  return res.rows[0] ? mapUser(res.rows[0]) : null
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const res = await getPool().query(`SELECT * FROM users WHERE id = $1`, [id])
  return res.rows[0] ? mapUser(res.rows[0]) : null
}

export async function insertUser(input: {
  email: string
  password_hash: string
  display_name?: string | null
  role?: UserRole
}): Promise<UserRow> {
  const bootstrap = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const role: UserRole =
    input.role ??
    (bootstrap && input.email === bootstrap ? 'admin' : 'user')

  const res = await getPool().query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.email, input.password_hash, input.display_name ?? null, role],
  )
  return mapUser(res.rows[0])
}

export async function setUserRole(userId: number, role: UserRole) {
  await getPool().query(
    `UPDATE users SET role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [userId, role],
  )
}

export async function markEmailVerified(userId: number) {
  await getPool().query(
    `UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [userId],
  )
}

export async function setFailedLogin(userId: number, count: number, lockedUntil: Date | null) {
  await getPool().query(
    `UPDATE users
     SET failed_login_count = $2,
         locked_until = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, count, lockedUntil],
  )
}

export async function clearFailedLogin(userId: number) {
  await getPool().query(
    `UPDATE users
     SET failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId],
  )
}

export async function setMfaEnabled(userId: number, enabled: boolean, secret: string | null) {
  await getPool().query(
    `UPDATE users
     SET mfa_enabled = $2, mfa_secret = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, enabled, secret],
  )
}

export async function createSession(input: {
  user_id: number
  token_hash: string
  expires_at: Date
  ip_address?: string | null
  user_agent?: string | null
}) {
  await getPool().query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.user_id,
      input.token_hash,
      input.expires_at,
      input.ip_address ?? null,
      input.user_agent ?? null,
    ],
  )
}

export async function findSessionUser(tokenHash: string): Promise<UserRow | null> {
  const res = await getPool().query(
    `SELECT u.*
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
    [tokenHash],
  )
  if (!res.rows[0]) return null
  await getPool().query(
    `UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1`,
    [tokenHash],
  )
  return mapUser(res.rows[0])
}

export async function deleteSession(tokenHash: string) {
  await getPool().query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [tokenHash])
}

export async function deleteUserSessions(userId: number) {
  await getPool().query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId])
}

export async function createEmailVerificationToken(input: {
  user_id: number
  token_hash: string
  expires_at: Date
}) {
  await getPool().query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [input.user_id, input.token_hash, input.expires_at],
  )
}

export async function consumeEmailVerificationToken(tokenHash: string): Promise<number | null> {
  const res = await getPool().query(
    `UPDATE email_verification_tokens
     SET used_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING user_id`,
    [tokenHash],
  )
  return res.rows[0]?.user_id ?? null
}

export async function recordLoginAttempt(input: {
  email: string
  success: boolean
  ip_address?: string | null
}) {
  await getPool().query(
    `INSERT INTO login_attempts (email, success, ip_address) VALUES ($1, $2, $3)`,
    [input.email, input.success, input.ip_address ?? null],
  )
}
