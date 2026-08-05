const API = import.meta.env.VITE_API_URL || ''

export type RampStatus = {
  ok: boolean
  configured: boolean
  env: string
  apiBase: string
  authorizeBase: string
  redirectUri: string
  scopes: string
  clientIdSet: boolean
  hasStoredUserToken?: boolean
  hasRefreshToken?: boolean
  hint?: string
}

export type RampTxn = {
  id: string
  amount: number
  merchant_name?: string | null
  state?: string | null
  user_transaction_time?: string | null
  currency_code?: string
  card_holder?: { name?: string; department_name?: string | null } | null
}

export type RampTransactionsResponse = {
  ok: boolean
  env: string
  authSource?: string
  scope?: string
  count: number
  pages: number
  next: string | null
  totalAmount: number
  transactions: RampTxn[]
  error?: string
  hint?: string
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: 'include' })
  const body = (await res.json()) as T & { error?: string; hint?: string }
  if (!res.ok) {
    throw new Error([body.error, body.hint].filter(Boolean).join(' — ') || res.statusText)
  }
  return body
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as T & { error?: string; hint?: string }
  if (!res.ok) {
    throw new Error([json.error, json.hint].filter(Boolean).join(' — ') || res.statusText)
  }
  return json
}

export function fetchRampStatus() {
  return getJson<RampStatus>('/api/ramp/status')
}

export function fetchRampTransactions(pageSize = 25, maxPages = 2) {
  return getJson<RampTransactionsResponse>(
    `/api/ramp/transactions?page_size=${pageSize}&max_pages=${maxPages}`,
  )
}

export function fetchRampAuthorizeUrl() {
  return getJson<{ ok: boolean; url: string; state: string; redirectUri: string }>(
    '/api/ramp/oauth/url',
  )
}

export function exchangeRampCode(code: string) {
  return postJson<{
    ok: boolean
    scope?: string
    expires_in?: number
    hasRefreshToken?: boolean
  }>('/api/ramp/oauth/exchange', { code })
}

export function formatRampUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
