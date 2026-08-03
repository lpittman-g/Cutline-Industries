import { promises as fs } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { runOnce } from './autopilot.ts'
import { runAiPipelineOnce } from './aiPipeline.ts'
import {
  approvalPageUrl,
  approvalStatus,
  createApprovalRequest,
  notifyViaNtfy,
  readPending,
  registerDevice,
  resolvePending,
  waitForApproval,
} from './deviceApproval.ts'
import { loadFeedbackReport, runFeedbackLoop, saveAudienceInput } from './youtubeFeedback.ts'
import { getGoogleCloudStatus, getYoutubeChannel } from './googleCloud.ts'
import {
  ROOT,
  saveTokenFromRefresh,
  saveTokenFromAuthorizationCode,
  buildYoutubeAuthUrl,
  TOKEN_PATH,
  SECRET_PATH,
} from './youtubeAuth.ts'
import { registerThermalRoutes } from './thermalApi.ts'
import { registerStripeWebhookRoute } from './stripeCheckout.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const app = express()
const PORT = Number(process.env.CUTLINE_API_PORT || 8787)

app.use(cors())
registerStripeWebhookRoute(app)
app.use(express.json({ limit: '1mb' }))

async function readJsonSafe<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, brand: 'Cutline Industries', service: 'cutline-autopilot' })
})

app.get('/api/autopilot/status', async (_req, res) => {
  const state = await readJsonSafe(path.join(ROOT, 'autopilot-state.json'), {
    processed: {},
    lastRun: null,
    lastError: null,
    running: false,
  })
  let hasSecret = false
  let hasToken = false
  try {
    await fs.access(SECRET_PATH)
    hasSecret = true
  } catch {
    hasSecret = false
  }
  try {
    await fs.access(TOKEN_PATH)
    hasToken = true
  } catch {
    hasToken = false
  }

  let inbox: string[] = []
  try {
    inbox = (await fs.readdir(path.join(ROOT, 'inbox'))).filter((f) =>
      /\.(mp4|mov|mkv|webm)$/i.test(f),
    )
  } catch {
    inbox = []
  }

  let logTail = ''
  try {
    const log = await fs.readFile(path.join(ROOT, 'autopilot.log'), 'utf8')
    logTail = log.trim().split('\n').slice(-30).join('\n')
  } catch {
    logTail = ''
  }

  res.json({
    brand: 'Cutline Industries',
    domain: 'cutline-industries.studio',
    hasSecret,
    hasToken,
    dryRun: process.env.CUTLINE_DRY_RUN === '1' || !hasToken,
    privacy: process.env.CUTLINE_PRIVACY || 'private',
    game: process.env.CUTLINE_GAME || 'Valorant',
    niche: process.env.CUTLINE_NICHE || 'fps',
    inboxCount: inbox.length,
    inbox,
    state,
    logTail,
  })
})

app.post('/api/autopilot/token', async (req, res) => {
  try {
    const refreshToken = String(req.body?.refresh_token || '').trim()
    if (!refreshToken) {
      res.status(400).json({ error: 'refresh_token required' })
      return
    }
    await saveTokenFromRefresh(refreshToken)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/autopilot/run-once', async (_req, res) => {
  try {
    await runOnce()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/ai-pipeline/status', async (_req, res) => {
  const state = await readJsonSafe(path.join(ROOT, 'ai-pipeline-state.json'), {
    processedTopics: {},
    lastRun: null,
    lastError: null,
    running: false,
  })
  const report = await loadFeedbackReport()
  let logTail = ''
  try {
    const log = await fs.readFile(path.join(ROOT, 'ai-pipeline.log'), 'utf8')
    logTail = log.trim().split('\n').slice(-30).join('\n')
  } catch {
    logTail = ''
  }
  res.json({
    brand: 'Cutline Industries',
    product: 'Thermal',
    mode: process.env.CUTLINE_AI_MODE || 'project',
    privacy: process.env.CUTLINE_AI_PRIVACY || process.env.CUTLINE_PRIVACY || 'public',
    dryRun: process.env.CUTLINE_DRY_RUN === '1',
    maxShorts: Number(process.env.CUTLINE_AI_MAX_SHORTS || 3),
    state,
    report,
    logTail,
  })
})

app.get('/api/ai-pipeline/feedback', async (_req, res) => {
  const report = await loadFeedbackReport()
  res.json({ ok: true, report })
})

app.post('/api/ai-pipeline/feedback', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim()
    const source = (req.body?.source as 'site' | 'api') || 'api'
    if (!message) {
      res.status(400).json({ error: 'message required' })
      return
    }
    const row = await saveAudienceInput(message, source)
    res.json({ ok: true, input: row })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/ai-pipeline/feedback/refresh', async (_req, res) => {
  try {
    const report = await runFeedbackLoop()
    res.json({ ok: true, report })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/ai-pipeline/run-once', async (_req, res) => {
  try {
    const state = await runAiPipelineOnce()
    res.json({ ok: true, state })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/approval/status', (_req, res) => {
  res.json(approvalStatus())
})

app.post('/api/approval/register-device', async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || '').trim()
    const label = String(req.body?.label || 'My iPhone').trim()
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId required' })
      return
    }
    const device = await registerDevice({
      deviceId,
      label,
      userAgent: String(req.body?.userAgent || ''),
    })
    res.json({ ok: true, device })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/approval/:id', async (req, res) => {
  const rec = await readPending(req.params.id)
  if (!rec) {
    res.status(404).json({ error: 'unknown approvalId' })
    return
  }
  res.json(rec)
})

app.post('/api/approval/:id/decide', async (req, res) => {
  try {
    const decision = req.body?.decision
    if (decision !== 'approved' && decision !== 'denied') {
      res.status(400).json({ error: 'decision must be approved or denied' })
      return
    }
    const rec = await resolvePending(req.params.id, decision)
    if (!rec) {
      res.status(404).json({ error: 'unknown approvalId' })
      return
    }
    res.json(rec)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/approval/request', async (req, res) => {
  try {
    const service = String(req.body?.service || '').trim()
    if (!service) {
      res.status(400).json({ error: 'service required' })
      return
    }
    const waitSeconds = Number(req.body?.waitSeconds ?? 180)
    const rec = await createApprovalRequest({
      service,
      detail: String(req.body?.detail || ''),
      desktopUrl: req.body?.desktopUrl ? String(req.body.desktopUrl) : null,
    })
    const push = await notifyViaNtfy({
      title: `Approve sign-in: ${service}`,
      body: rec.detail || `Agent needs approval for ${service}`,
      approvalId: rec.id,
      service,
      desktopUrl: rec.desktopUrl,
    })
    if (waitSeconds > 0) {
      const final = await waitForApproval(rec.id, waitSeconds)
      res.json({
        ok: final?.status !== 'pending',
        approvalId: rec.id,
        status: final?.status ?? 'timeout',
        push,
        approveUrl: approvalPageUrl(rec.id),
      })
      return
    }
    res.json({
      ok: true,
      approvalId: rec.id,
      status: 'pending',
      push,
      approveUrl: approvalPageUrl(rec.id),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/google/status', async (_req, res) => {
  try {
    res.json(await getGoogleCloudStatus())
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/google/youtube/channel', async (_req, res) => {
  try {
    const channel = await getYoutubeChannel()
    res.json({ ok: true, channel })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('Not authorized') ? 401 : 500
    res.status(status).json({ error: message })
  }
})

app.get('/api/google/oauth/url', async (_req, res) => {
  try {
    const url = await buildYoutubeAuthUrl()
    res.json({
      ok: true,
      account: 'lpittman@cutline-industries.studio',
      url,
      instructions: [
        'Open url and sign in as lpittman@cutline-industries.studio',
        'Allow YouTube access',
        'On the OAuth Playground page, copy the code= value from the browser URL or Step 2 authorization code',
        'POST { "code": "4/..." } to /api/google/oauth/exchange',
      ],
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/google/oauth/exchange', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim()
    if (!code) {
      res.status(400).json({ error: 'code required (OAuth authorization code)' })
      return
    }
    const tokens = await saveTokenFromAuthorizationCode(code)
    let channel = null
    try {
      channel = await getYoutubeChannel()
    } catch {
      channel = null
    }
    res.json({
      ok: true,
      hasRefreshToken: Boolean(tokens.refresh_token),
      scope: tokens.scope,
      channel,
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

/** Public deal packages for Spark / Surge / Eclipse. */
const DEAL_PACKAGES = [
  {
    id: 'spark',
    name: 'Spark Pack',
    price: '$750',
    priceCents: 75000,
    includes: ['10 Shorts', 'Titles + hooks', '72h delivery', '1 revision'],
  },
  {
    id: 'surge',
    name: 'Surge Retainer',
    price: '$2,500/mo',
    priceCents: 250000,
    includes: ['40 Shorts / month', 'Weekly strategy', 'Priority Autopilot', 'Monthly report'],
  },
  {
    id: 'eclipse',
    name: 'Eclipse Integration',
    price: '$5,000+',
    priceCents: 500000,
    includes: ['Sponsored longform + Shorts', 'Custom CTA kit', 'Usage rights', 'Whitelisting add-on'],
  },
] as const

const LEADS_PATH = path.join(ROOT, 'leads.json')

type Lead = {
  id: string
  name: string
  email: string
  company?: string
  packageId?: string
  message?: string
  source?: string
  createdAt: string
}

app.get('/api/deals', (_req, res) => {
  res.json({
    brand: 'Cutline Industries',
    currency: 'USD',
    contact: 'lpittman@cutline-industries.studio',
    packages: DEAL_PACKAGES,
  })
})

/** Operating blueprint + live YouTube / auth status for /blueprint UI. */
app.get('/api/blueprint', async (_req, res) => {
  try {
    const google = await getGoogleCloudStatus()
    let channel: Awaited<ReturnType<typeof getYoutubeChannel>> | null = null
    let youtubeError: string | undefined
    if (google.oauth.authorized) {
      try {
        channel = await getYoutubeChannel()
      } catch (err) {
        youtubeError = err instanceof Error ? err.message : String(err)
      }
    } else {
      youtubeError = 'Not authorized — save refresh_token first'
    }

    const systems = [
      {
        id: 'youtube-oauth',
        name: 'YouTube OAuth',
        status: google.oauth.authorized ? 'live' : 'blocked',
        detail: google.oauth.authorized
          ? `Authorized · ${google.oauth.clientId}`
          : 'Missing token.json refresh token',
      },
      {
        id: 'youtube-channel',
        name: 'YouTube channel',
        status: channel ? 'live' : 'blocked',
        detail: channel
          ? `${channel.title} (${channel.customUrl || channel.id}) · ${channel.stats?.videoCount || 0} videos`
          : youtubeError || 'No channel',
      },
      {
        id: 'adsense',
        name: 'AdSense',
        status: google.site.adsenseClient ? 'live' : 'next',
        detail: google.site.adsenseClient
          ? `${google.site.adsenseClient} — add slot ID + confirm domain`
          : 'Not configured',
      },
      {
        id: 'site',
        name: 'cutline-industries.studio',
        status: 'next',
        detail: 'Confirm Amplify + Route 53 nameservers (not Squarespace)',
      },
      {
        id: 'deals',
        name: 'Deal packages',
        status: 'live',
        detail: 'Spark $750 · Surge $2500 · Eclipse $5000+',
      },
      {
        id: 'stripe',
        name: 'Stripe pay links',
        status: 'blocked',
        detail: 'Create Spark + Surge payment links',
      },
    ]

    res.json({
      ok: true,
      brand: 'Cutline Industries',
      mission:
        'Cutline Industries platform → terminal → ops → revenue.',
      doc: 'docs/CUTLINE-BLUEPRINT.md',
      youtube: {
        authorized: google.oauth.authorized,
        channel,
        error: youtubeError,
      },
      google,
      systems,
      offers: DEAL_PACKAGES,
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/leads', async (_req, res) => {
  const leads = await readJsonSafe<Lead[]>(LEADS_PATH, [])
  res.json({ count: leads.length, leads })
})

app.post('/api/leads', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const company = String(req.body?.company || '').trim() || undefined
    const packageId = String(req.body?.packageId || req.body?.package || '').trim() || undefined
    const message = String(req.body?.message || '').trim() || undefined
    const source = String(req.body?.source || 'api').trim() || 'api'

    if (!name || !email) {
      res.status(400).json({ error: 'name and email required' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'valid email required' })
      return
    }
    if (packageId && !DEAL_PACKAGES.some((p) => p.id === packageId)) {
      res.status(400).json({ error: 'packageId must be spark, surge, or eclipse' })
      return
    }

    const lead: Lead = {
      id: `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      company,
      packageId,
      message,
      source,
      createdAt: new Date().toISOString(),
    }

    const existing = await readJsonSafe<Lead[]>(LEADS_PATH, [])
    existing.unshift(lead)
    await fs.writeFile(LEADS_PATH, JSON.stringify(existing, null, 2), 'utf8')

    res.status(201).json({ ok: true, lead })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

/** Thermal core schema status (Postgres migration 001). */
app.get('/api/thermal/schema', async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  const migrationFile = 'db/migrations/001_thermal_core.sql'
  const tables = ['streamers', 'heat_spikes', 'clips', 'retainers', 'sales', 'bounty_posts']

  if (!databaseUrl) {
    res.json({
      ok: true,
      platform: 'Thermal',
      connected: false,
      migrationFile,
      tables,
      next: 'Set DATABASE_URL then run npm run db:migrate',
    })
    return
  }

  try {
    const pg = await import('pg')
    const client = new pg.default.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const result = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])
         ORDER BY table_name`,
        [tables],
      )
      const present = result.rows.map((r: { table_name: string }) => r.table_name)
      res.json({
        ok: true,
        platform: 'Thermal',
        connected: true,
        migrationFile,
        tables,
        present,
        migrated: tables.every((t) => present.includes(t)),
      })
    } finally {
      await client.end()
    }
  } catch (err) {
    res.status(500).json({
      ok: false,
      platform: 'Thermal',
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

registerThermalRoutes(app)

app.listen(PORT, () => {
  console.log(`Cutline Industries API on http://127.0.0.1:${PORT}`)
})

