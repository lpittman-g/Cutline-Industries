/**
 * Squarespace Commerce API client for cutline-industries.studio.
 * Auth: Developer API key (Bearer). Read website + commerce catalog.
 */

export type SquarespaceWebsite = {
  id: string
  siteId: string
  title: string
  url: string
  currency: string
  measurementStandard?: string
  language?: string
  timeZone?: string
}

export type SquarespaceProductSummary = {
  id: string
  name: string
  type: string
  url: string
  isVisible: boolean
  variantCount: number
}

const API_BASE = 'https://api.squarespace.com/1.0'
const USER_AGENT = 'CutlineIndustries/1.0 (+https://cutline-industries.studio)'

export function squarespaceConfigured(): boolean {
  return Boolean(process.env.SQUARESPACE_API_KEY?.trim())
}

export function squarespaceSiteUrl(): string {
  return (
    process.env.SQUARESPACE_SITE_URL?.trim() ||
    process.env.CUTLINE_PUBLIC_URL?.trim() ||
    'https://www.cutline-industries.studio'
  )
}

export function squarespaceStatusPayload() {
  return {
    configured: squarespaceConfigured(),
    siteUrl: squarespaceSiteUrl(),
    apiBase: API_BASE,
    hostingNote:
      'Squarespace Commerce API syncs store data. Hosting the Cutline SPA on this domain requires DNS cutover to Amplify/Route 53 (see docs/SQUARESPACE.md).',
  }
}

function apiKey(): string {
  const key = process.env.SQUARESPACE_API_KEY?.trim()
  if (!key) throw new Error('SQUARESPACE_API_KEY not configured')
  return key
}

async function squarespaceFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  })
  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Squarespace ${path}: non-JSON HTTP ${res.status}`)
  }
  if (!res.ok) {
    const err = json as { message?: string; type?: string } | null
    throw new Error(err?.message || `Squarespace ${path}: HTTP ${res.status}`)
  }
  return json as T
}

export async function getSquarespaceWebsite(): Promise<SquarespaceWebsite> {
  return squarespaceFetch<SquarespaceWebsite>('/authorization/website')
}

export async function listSquarespaceProducts(limit = 50): Promise<SquarespaceProductSummary[]> {
  const capped = Math.min(Math.max(limit, 1), 100)
  const data = await squarespaceFetch<{
    products?: Array<{
      id: string
      name: string
      type: string
      url: string
      isVisible: boolean
      variants?: unknown[]
    }>
  }>(`/commerce/products?limit=${capped}`)

  return (data.products || []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    url: p.url,
    isVisible: p.isVisible,
    variantCount: Array.isArray(p.variants) ? p.variants.length : 0,
  }))
}

export async function probeSquarespaceSitePublic(url = squarespaceSiteUrl()): Promise<{
  url: string
  httpStatus: number
  privateSite: boolean
  server: string | null
}> {
  const res = await fetch(url, { redirect: 'manual' })
  const server = res.headers.get('server')
  return {
    url,
    httpStatus: res.status,
    privateSite: res.status === 401,
    server,
  }
}
