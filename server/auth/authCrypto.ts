import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type AuthConfig = {
  auth_configuration: {
    sign_up_rules: {
      require_email_verification: boolean
      allow_public_registration: boolean
      blocked_domains: string[]
      password_policy: {
        min_length: number
        require_uppercase: boolean
        require_numbers: boolean
        require_special_characters: boolean
      }
    }
    sign_in_rules: {
      max_login_attempts: number
      lockout_duration_minutes: number
      session_timeout_hours: number
      multi_factor_authentication: 'optional' | 'required' | 'off'
    }
  }
}

let cached: AuthConfig | null = null

export async function loadAuthConfig(): Promise<AuthConfig> {
  if (cached) return cached
  const raw = await fs.readFile(path.join(__dirname, 'auth.config.json'), 'utf8')
  cached = JSON.parse(raw) as AuthConfig
  return cached
}

export function publicBaseUrl() {
  return (
    process.env.THERMAL_PUBLIC_URL ||
    process.env.CUTLINE_PUBLIC_URL ||
    'http://127.0.0.1:5173'
  ).replace(/\/$/, '')
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function emailDomain(email: string) {
  const at = email.lastIndexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ''
}

export function validatePassword(password: string, policy: AuthConfig['auth_configuration']['sign_up_rules']['password_policy']) {
  const errors: string[] = []
  if (password.length < policy.min_length) {
    errors.push(`Password must be at least ${policy.min_length} characters`)
  }
  if (policy.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include an uppercase letter')
  }
  if (policy.require_numbers && !/[0-9]/.test(password)) {
    errors.push('Password must include a number')
  }
  if (policy.require_special_characters && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must include a special character')
  }
  return errors
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = (await scrypt(password, salt, expected.length)) as Buffer
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function newOpaqueToken() {
  return randomBytes(32).toString('hex')
}

export const SESSION_COOKIE = 'cutline_session'
