/**
 * OAuth 2.0 sign-in for Google, Microsoft, and Apple.
 *
 * Required env vars (set in Vercel project settings, never in code):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 *   APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY  (base64-encoded PEM)
 *
 * Flow: GET /api/auth/oauth/:provider → redirect to provider
 *       GET /api/auth/oauth/:provider/callback → exchange code, create session
 */
import { createHash, createSign, randomBytes } from 'node:crypto'
import type { Express, Request, Response } from 'express'
import {
  SESSION_COOKIE,
  hashToken,
  newOpaqueToken,
  normalizeEmail,
  publicBaseUrl,
} from './authCrypto.ts'
import {
  createSession,
  findUserByEmail,
  insertUser,
  markEmailVerified,
  toPublicUser,
} from './authRepo.ts'
import { thermalDbEnabled } from '../db/pool.ts'

const OAUTH_STATE_COOKIE = 'cutline_oauth_state'
const CALLBACK_BASE = () =>
  (process.env.CUTLINE_PUBLIC_URL || process.env.THERMAL_PUBLIC_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')

type OAuthProvider = 'google' | 'microsoft' | 'apple'

function isProvider(s: string): s is OAuthProvider {
  return s === 'google' || s === 'microsoft' || s === 'apple'
}

// ── State / CSRF helpers ───────────────────────────────────────────────────────

function setStateCookie(res: Response, state: string) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.CUTLINE_PUBLIC_URL)
  const parts = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=600',
  ]
  if (secure) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

function clearStateCookie(res: Response) {
  res.append(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  )
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function newState() {
  return randomBytes(24).toString('hex')
}

// ── Authorization URL builders ─────────────────────────────────────────────────

function googleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')
  const redirect = `${CALLBACK_BASE()}/api/auth/oauth/google/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

function microsoftAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  if (!clientId) throw new Error('MICROSOFT_CLIENT_ID not configured')
  const redirect = `${CALLBACK_BASE()}/api/auth/oauth/microsoft/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    response_mode: 'query',
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

function appleAuthUrl(state: string): string {
  const clientId = process.env.APPLE_CLIENT_ID
  if (!clientId) throw new Error('APPLE_CLIENT_ID not configured')
  const redirect = `${CALLBACK_BASE()}/api/auth/oauth/apple/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'name email',
    state,
    response_mode: 'form_post',
  })
  return `https://appleid.apple.com/auth/authorize?${params}`
}

// ── Token exchange helpers ────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  id_token?: string
  token_type: string
}

async function exchangeGoogle(code: string): Promise<{ email: string; name: string | null }> {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirect = `${CALLBACK_BASE()}/api/auth/oauth/google/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  })
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${await tokenRes.text()}`)
  const tokens = (await tokenRes.json()) as TokenResponse

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) throw new Error('Google userinfo fetch failed')
  const info = (await userRes.json()) as { email?: string; name?: string }
  if (!info.email) throw new Error('Google did not return an email address')
  return { email: info.email, name: info.name ?? null }
}

async function exchangeMicrosoft(code: string): Promise<{ email: string; name: string | null }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID!
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!
  const redirect = `${CALLBACK_BASE()}/api/auth/oauth/microsoft/callback`

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', scope: 'openid email profile' }),
  })
  if (!tokenRes.ok) throw new Error(`Microsoft token exchange failed: ${await tokenRes.text()}`)
  const tokens = (await tokenRes.json()) as TokenResponse

  const userRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) throw new Error('Microsoft graph fetch failed')
  const info = (await userRes.json()) as { mail?: string; userPrincipalName?: string; displayName?: string }
  const email = info.mail || info.userPrincipalName
  if (!email) throw new Error('Microsoft did not return an email address')
  return { email, name: info.displayName ?? null }
}

function buildAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID!
  const clientId = process.env.APPLE_CLIENT_ID!
  const keyId = process.env.APPLE_KEY_ID!
  const privateKey = Buffer.from(process.env.APPLE_PRIVATE_KEY!, 'base64').toString('utf8')

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: teamId, iat: now, exp: now + 180, aud: 'https://appleid.apple.com', sub: clientId,
  })).toString('base64url')

  const signer = createSign('SHA256')
  signer.update(`${header}.${payload}`)
  const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${header}.${payload}.${sig}`
}

async function exchangeApple(code: string, body: Record<string, string>): Promise<{ email: string; name: string | null }> {
  const clientId = process.env.APPLE_CLIENT_ID!
  const redirect = `${CALLBACK_BASE()}/api/auth/oauth/apple/callback`
  const clientSecret = buildAppleClientSecret()

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  })
  if (!tokenRes.ok) throw new Error(`Apple token exchange failed: ${await tokenRes.text()}`)
  const tokens = (await tokenRes.json()) as TokenResponse

  // Apple returns email in the id_token JWT payload (first-time sign-in only)
  if (!tokens.id_token) throw new Error('Apple did not return id_token')
  const payloadB64 = tokens.id_token.split('.')[1]
  if (!payloadB64) throw new Error('Malformed Apple id_token')
  const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { email?: string; sub?: string }

  // On first sign-in, Apple POST body may include user JSON with name
  let name: string | null = null
  try {
    const userJson = body.user ? (JSON.parse(body.user) as { name?: { firstName?: string; lastName?: string } }) : null
    if (userJson?.name) name = [userJson.name.firstName, userJson.name.lastName].filter(Boolean).join(' ') || null
  } catch { /* ignore */ }

  const email = claims.email
  if (!email) throw new Error('Apple did not return an email address')
  return { email, name }
}

// ── Session creation ───────────────────────────────────────────────────────────

function setSessionCookie(res: Response, token: string, maxAgeMs: number) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.CUTLINE_PUBLIC_URL)
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

async function findOrCreateOAuthUser(email: string, name: string | null) {
  const normalized = normalizeEmail(email)
  let user = await findUserByEmail(normalized)
  if (!user) {
    user = await insertUser({
      email: normalized,
      password_hash: '',           // no password for OAuth users
      display_name: name,
    })
    await markEmailVerified(user.id)
  }
  return user
}

function clientIp(req: Request) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0]?.trim() ?? null
  return req.socket.remoteAddress ?? null
}

// ── Route registration ─────────────────────────────────────────────────────────

export function registerOAuthRoutes(app: Express) {
  // ── Step 1: Redirect to provider ──────────────────────────────────────────
  app.get('/api/auth/oauth/:provider', (req, res) => {
    const provider = req.params.provider
    if (!isProvider(provider)) {
      res.status(400).json({ error: 'Unknown provider' })
      return
    }
    if (!thermalDbEnabled()) {
      res.status(503).json({ error: 'Database not configured' })
      return
    }

    try {
      const state = newState()
      setStateCookie(res, state)

      let url: string
      if (provider === 'google') url = googleAuthUrl(state)
      else if (provider === 'microsoft') url = microsoftAuthUrl(state)
      else url = appleAuthUrl(state)

      res.redirect(302, url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.redirect(302, `${publicBaseUrl()}/signin?error=${encodeURIComponent(msg)}`)
    }
  })

  // ── Step 2: Handle provider callback ─────────────────────────────────────
  const handleCallback = async (req: Request, res: Response, provider: OAuthProvider) => {
    const code = String(req.query.code ?? req.body?.code ?? '')
    const returnedState = String(req.query.state ?? req.body?.state ?? '')
    const error = String(req.query.error ?? req.body?.error ?? '')

    clearStateCookie(res)

    if (error) {
      res.redirect(302, `${publicBaseUrl()}/signin?error=${encodeURIComponent(error)}`)
      return
    }

    const cookies = parseCookies(req.headers.cookie)
    const storedState = cookies[OAUTH_STATE_COOKIE]
    if (!storedState || !returnedState || storedState !== returnedState) {
      res.redirect(302, `${publicBaseUrl()}/signin?error=state_mismatch`)
      return
    }
    if (!code) {
      res.redirect(302, `${publicBaseUrl()}/signin?error=no_code`)
      return
    }

    try {
      let info: { email: string; name: string | null }
      if (provider === 'google') info = await exchangeGoogle(code)
      else if (provider === 'microsoft') info = await exchangeMicrosoft(code)
      else info = await exchangeApple(code, req.body as Record<string, string>)

      const user = await findOrCreateOAuthUser(info.email, info.name)
      const raw = newOpaqueToken()
      const maxAgeMs = 24 * 60 * 60 * 1000  // 24 h
      await createSession({
        user_id: user.id,
        token_hash: hashToken(raw),
        expires_at: new Date(Date.now() + maxAgeMs),
        ip_address: clientIp(req),
        user_agent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      })
      setSessionCookie(res, raw, maxAgeMs)
      res.redirect(302, `${publicBaseUrl()}/console?view=chat`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[oauth:${provider}] callback error`, msg)
      res.redirect(302, `${publicBaseUrl()}/signin?error=${encodeURIComponent('Sign-in failed — try again')}`)
    }
  }

  app.get('/api/auth/oauth/google/callback', (req, res) => void handleCallback(req, res, 'google'))
  app.get('/api/auth/oauth/microsoft/callback', (req, res) => void handleCallback(req, res, 'microsoft'))
  // Apple uses form_post so it sends POST
  app.post('/api/auth/oauth/apple/callback', (req, res) => void handleCallback(req, res, 'apple'))
}
