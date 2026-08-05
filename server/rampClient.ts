/**
 * Ramp Developer API client (demo by default).
 * Supports client_credentials and authorization_code (+ refresh).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ROOT } from './youtubeAuth.ts'

export type RampEnvName = 'demo' | 'production'

export type RampToken = {
  access_token: string
  token_type?: string
  expires_in?: number
  scope?: string
  refresh_token?: string
  obtained_at: number
  grant_type: 'client_credentials' | 'authorization_code' | 'refresh_token'
}

export type RampTransaction = {
  id: string
  amount: number
  merchant_name?: string | null
  state?: string | null
  user_transaction_time?: string | null
  currency_code?: string | null
  card_holder?: {
    first_name?: string | null
    last_name?: string | null
    department_name?: string | null
  } | null
}

const TOKEN_PATH = path.join(ROOT, 'ramp_token.json')

export function rampEnv(): RampEnvName {
  const raw = (process.env.RAMP_ENV || 'demo').trim().toLowerCase()
  return raw === 'production' || raw === 'prod' ? 'production' : 'demo'
}

export function rampApiBase(): string {
  return rampEnv() === 'production'
    ? 'https://api.ramp.com/developer/v1'
    : 'https://demo-api.ramp.com/developer/v1'
}

export function rampAuthorizeBase(): string {
  return rampEnv() === 'production' ? 'https://app.ramp.com' : 'https://demo.ramp.com'
}

export function rampConfigured(): boolean {
  return Boolean(
    process.env.RAMP_CLIENT_ID?.trim() && process.env.RAMP_CLIENT_SECRET?.trim(),
  )
}

export function rampRedirectUri(): string {
  return (
    process.env.RAMP_REDIRECT_URI?.trim() ||
    `${process.env.CUTLINE_PUBLIC_URL || 'https://cutline-industries.studio'}/callback`
  )
}

export function rampScopes(): string {
  return process.env.RAMP_SCOPES?.trim() || 'transactions:read'
}

function basicAuthHeader(): string {
  const id = process.env.RAMP_CLIENT_ID?.trim()
  const secret = process.env.RAMP_CLIENT_SECRET?.trim()
  if (!id || !secret) throw new Error('RAMP_CLIENT_ID / RAMP_CLIENT_SECRET not configured')
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

async function postToken(body: URLSearchParams): Promise<RampToken> {
  const res = await fetch(`${rampApiBase()}/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || typeof json.access_token !== 'string') {
    const v2 = json.error_v2 as { message?: string; error_code?: string } | undefined
    const err = json.error as { message?: string } | string | undefined
    const message =
      v2?.message ||
      (typeof err === 'object' ? err?.message : err) ||
      `Ramp token HTTP ${res.status}`
    const code = v2?.error_code ? ` (${v2.error_code})` : ''
    throw new Error(`${message}${code}`)
  }
  return {
    access_token: json.access_token,
    token_type: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
    expires_in: typeof json.expires_in === 'number' ? json.expires_in : undefined,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    obtained_at: Date.now(),
    grant_type: (body.get('grant_type') as RampToken['grant_type']) || 'client_credentials',
  }
}

export async function fetchClientCredentialsToken(
  scopes = rampScopes(),
): Promise<RampToken> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: scopes,
  })
  return postToken(body)
}

export async function exchangeAuthorizationCode(code: string): Promise<RampToken> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: rampRedirectUri(),
  })
  const token = await postToken(body)
  await saveRampToken(token)
  return token
}

export async function refreshAccessToken(refreshToken: string): Promise<RampToken> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const token = await postToken(body)
  await saveRampToken(token)
  return token
}

export async function saveRampToken(token: RampToken): Promise<void> {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), 'utf8')
}

export async function loadRampToken(): Promise<RampToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, 'utf8')
    return JSON.parse(raw) as RampToken
  } catch {
    return null
  }
}

function tokenFresh(token: RampToken, skewMs = 60_000): boolean {
  if (!token.expires_in) return true
  return token.obtained_at + token.expires_in * 1000 - skewMs > Date.now()
}

/** Prefer stored user token; else client_credentials. */
export async function getAccessToken(): Promise<{
  token: string
  source: 'stored' | 'client_credentials' | 'refreshed'
  scope?: string
}> {
  const stored = await loadRampToken()
  if (stored?.access_token && tokenFresh(stored)) {
    return { token: stored.access_token, source: 'stored', scope: stored.scope }
  }
  if (stored?.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(stored.refresh_token)
      return {
        token: refreshed.access_token,
        source: 'refreshed',
        scope: refreshed.scope,
      }
    } catch {
      /* fall through to client credentials */
    }
  }
  const cc = await fetchClientCredentialsToken()
  return { token: cc.access_token, source: 'client_credentials', scope: cc.scope }
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.RAMP_CLIENT_ID?.trim() || '',
    redirect_uri: rampRedirectUri(),
    scope: rampScopes(),
    state,
  })
  return `${rampAuthorizeBase()}/v1/authorize?${params.toString()}`
}

export async function listTransactions(opts?: {
  pageSize?: number
  maxPages?: number
  startUrl?: string
}): Promise<{
  transactions: RampTransaction[]
  pages: number
  next: string | null
}> {
  const { token } = await getAccessToken()
  const pageSize = opts?.pageSize ?? 25
  const maxPages = opts?.maxPages ?? 3
  let url: string | null =
    opts?.startUrl || `${rampApiBase()}/transactions?page_size=${pageSize}`
  const transactions: RampTransaction[] = []
  let pages = 0

  while (url && pages < maxPages) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    const json = (await res.json()) as {
      data?: RampTransaction[]
      page?: { next?: string | null }
      error_v2?: { message?: string }
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(
        json.error_v2?.message ||
          json.error?.message ||
          `Ramp transactions HTTP ${res.status}`,
      )
    }
    transactions.push(...(json.data || []))
    url = json.page?.next || null
    pages += 1
  }

  return { transactions, pages, next: url }
}

export function rampStatusPayload() {
  return {
    configured: rampConfigured(),
    env: rampEnv(),
    apiBase: rampApiBase(),
    authorizeBase: rampAuthorizeBase(),
    redirectUri: rampRedirectUri(),
    scopes: rampScopes(),
    clientIdSet: Boolean(process.env.RAMP_CLIENT_ID?.trim()),
    hint:
      'Two Ramp apps: (A) Developer API for /api/ramp + Mission Control; (B) Cursor Agent Permissions (Client ID cutline) for MCP. See docs/RAMP.md. Re-enable Client credentials if DEVELOPER_7012.',
  }
}
