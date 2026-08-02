import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const SECRET_PATH = path.join(ROOT, 'client_secret.json')
export const TOKEN_PATH = path.join(ROOT, 'token.json')

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
]

type ClientSecretFile = {
  installed?: { client_id: string; client_secret: string; redirect_uris?: string[] }
  web?: { client_id: string; client_secret: string; redirect_uris?: string[] }
}

export async function loadClientSecret() {
  const raw = await fs.readFile(SECRET_PATH, 'utf8')
  const json = JSON.parse(raw) as ClientSecretFile
  const cfg = json.installed ?? json.web
  if (!cfg) throw new Error('client_secret.json missing installed/web credentials')
  return cfg
}

export async function getAuthorizedClient() {
  const cfg = await loadClientSecret()
  const oauth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret)
  try {
    const tokenRaw = await fs.readFile(TOKEN_PATH, 'utf8')
    oauth2.setCredentials(JSON.parse(tokenRaw))
    return oauth2
  } catch {
    throw new Error('Not authorized. Finish OAuth Playground and save token.json')
  }
}

export async function saveTokenFromRefresh(refreshToken: string) {
  const cfg = await loadClientSecret()
  const oauth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret)
  oauth2.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2.refreshAccessToken()
  const merged = {
    ...credentials,
    refresh_token: refreshToken,
  }
  await fs.writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2))
  return merged
}

/** Exchange an OAuth Playground authorization code for tokens and persist token.json. */
export async function saveTokenFromAuthorizationCode(code: string) {
  const cfg = await loadClientSecret()
  const redirectUri =
    cfg.redirect_uris?.[0] || 'https://developers.google.com/oauthplayground'
  const oauth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri)
  const { tokens } = await oauth2.getToken(code.trim())
  if (!tokens.access_token) {
    throw new Error('Token exchange failed — no access_token returned')
  }
  // Keep prior refresh_token if Google omits a new one on re-consent
  let previousRefresh: string | undefined
  try {
    const prev = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf8')) as { refresh_token?: string }
    previousRefresh = prev.refresh_token
  } catch {
    previousRefresh = undefined
  }
  const merged = {
    ...tokens,
    refresh_token: tokens.refresh_token || previousRefresh,
  }
  if (!merged.refresh_token) {
    throw new Error(
      'No refresh_token returned. Revoke Cutline Autopilot access at myaccount.google.com/permissions, then authorize again with prompt=consent.',
    )
  }
  await fs.writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2))
  return merged
}

export function getYoutubeAuthUrl() {
  const redirectUri = 'https://developers.google.com/oauthplayground'
  // sync helper used by API — callers should use async load when needed
  return redirectUri
}

export async function buildYoutubeAuthUrl() {
  const cfg = await loadClientSecret()
  const redirectUri =
    cfg.redirect_uris?.[0] || 'https://developers.google.com/oauthplayground'
  const oauth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri)
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: SCOPES,
  })
}

export async function runLocalAuthFlow() {
  const cfg = await loadClientSecret()
  const redirectUri = 'http://127.0.0.1:53682/oauth2callback'
  const oauth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        if (!req.url?.startsWith('/oauth2callback')) {
          res.writeHead(404)
          res.end('Not found')
          return
        }
        const url = new URL(req.url, redirectUri)
        const err = url.searchParams.get('error')
        if (err) throw new Error(err)
        const got = url.searchParams.get('code')
        if (!got) throw new Error('No code in callback')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>CUTLINE authorized</h1><p>You can close this tab.</p>')
        server.close()
        resolve(got)
      } catch (e) {
        res.writeHead(500)
        res.end(String(e))
        server.close()
        reject(e)
      }
    })
    server.listen(53682, '127.0.0.1', () => {
      console.log('Open this URL:\n', authUrl)
    })
  })

  const { tokens } = await oauth2.getToken(code)
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2))
  console.log('Saved token.json')
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  runLocalAuthFlow().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
