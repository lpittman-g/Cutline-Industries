import express, { type Express, type Request, type Response } from 'express'
import path from 'node:path'
import { thermalDbEnabled } from './db/pool.ts'
import {
  countClipsToday,
  countLiveStreamers,
  countQueuedBountyPosts,
  getClipById,
  listBountyClips,
  listBountyPosts,
  listClips,
  listHeatEvents,
  listRecentHeatAlert,
  listSales,
  listStreamers,
  listTopClips,
  markBountyPosted,
  queueBountyPost,
  revenueByTier,
  revenueTimeline,
  seedStreamersIfEmpty,
  totalRevenueCents,
  updateBountyMetrics,
} from './db/thermalRepo.ts'
import { triggerHeatEvent } from './heatPipeline.ts'
import {
  confirmCheckoutSession,
  createCheckoutSession,
  stripeConfigured,
  stripeModeLabel,
} from './stripeCheckout.ts'
import { startTwitchMonitor, syncStreamersFromTwitch } from './twitchMonitor.ts'
import { ROOT } from './youtubeAuth.ts'

const expressStaticThermal = express.static(path.join(ROOT, 'thermal_media'), {
  fallthrough: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=60')
  },
})

function dbRequired(_req: Request, res: Response, next: () => void) {
  if (!thermalDbEnabled()) {
    res.status(503).json({
      error: 'DATABASE_URL not configured',
      hint: 'Set DATABASE_URL and run npm run db:migrate',
    })
    return
  }
  next()
}

export function registerThermalRoutes(app: Express) {
  const defaultVod = path.join(ROOT, 'inbox', 'cutline_test_vod.mp4')

  app.use('/thermal-media', expressStaticThermal)

  app.get('/api/streamers', dbRequired, async (_req, res) => {
    await seedStreamersIfEmpty(defaultVod)
    const streamers = await listStreamers()
    res.json({ streamers })
  })

  app.post('/api/streamers/sync', dbRequired, async (_req, res) => {
    await seedStreamersIfEmpty(defaultVod)
    const result = await syncStreamersFromTwitch()
    res.json({ ok: true, ...result, streamers: await listStreamers() })
  })

  app.get('/api/heat-events', dbRequired, async (_req, res) => {
    res.json({ events: await listHeatEvents() })
  })

  app.post('/api/heat-events', dbRequired, async (req, res) => {
    try {
      const streamerId = Number(req.body?.streamerId)
      if (!streamerId) {
        res.status(400).json({ error: 'streamerId required' })
        return
      }
      const result = await triggerHeatEvent({
        streamerId,
        msgPerMin: req.body?.msgPerMin ? Number(req.body.msgPerMin) : undefined,
        vodUrl: req.body?.vodUrl ?? null,
        title: req.body?.title,
      })
      res.json({ ok: true, ...result })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/api/clips', dbRequired, async (_req, res) => {
    res.json({ clips: await listClips() })
  })

  app.get('/api/clips/top', dbRequired, async (_req, res) => {
    res.json({ clips: await listTopClips() })
  })

  app.get('/api/clips/:id', dbRequired, async (req, res) => {
    const id = Number(req.params.id)
    if (!id) {
      res.status(400).json({ error: 'Invalid clip id' })
      return
    }
    const clip = await getClipById(id)
    if (!clip) {
      res.status(404).json({ error: 'Clip not found' })
      return
    }
    res.json({ clip })
  })

  app.post('/api/checkout/session', dbRequired, async (req, res) => {
    if (!stripeConfigured()) {
      res.status(503).json({
        error: 'Stripe not configured',
        hint: 'Set STRIPE_SECRET_KEY in environment',
      })
      return
    }
    try {
      const clipId = Number(req.body?.clipId)
      if (!clipId) {
        res.status(400).json({ error: 'clipId required' })
        return
      }
      const session = await createCheckoutSession({
        clipId,
        tierOverride: req.body?.tier,
      })
      res.json({ ok: true, ...session })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/checkout/confirm', dbRequired, async (req, res) => {
    if (!stripeConfigured()) {
      res.status(503).json({ error: 'Stripe not configured' })
      return
    }
    try {
      const sessionId = String(req.body?.sessionId ?? '')
      if (!sessionId) {
        res.status(400).json({ error: 'sessionId required' })
        return
      }
      const result = await confirmCheckoutSession(sessionId)
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/api/dashboard/summary', dbRequired, async (_req, res) => {
    const alert = await listRecentHeatAlert()
    const clipsToday = await countClipsToday()
    const liveChannels = await countLiveStreamers()
    const revenueCents = await totalRevenueCents()
    const pendingBounty = await countQueuedBountyPosts()
    res.json({
      heatAlert: alert
        ? {
            msgPerMin: alert.msg_per_min,
            streamer: alert.streamer_username ?? 'unknown',
            spikeId: alert.id,
            status: alert.status,
          }
        : null,
      activeLiveChannels: liveChannels,
      dailyClipsRendered: clipsToday,
      totalRevenueCents: revenueCents,
      pendingOutreaches: pendingBounty,
      stripeMode: stripeModeLabel(),
    })
  })

  app.get('/api/dashboard/revenue-timeline', dbRequired, async (req, res) => {
    const days = Number(req.query.days ?? 30)
    res.json({
      timeline: await revenueTimeline(Number.isFinite(days) ? days : 30),
      byTier: await revenueByTier(),
    })
  })

  app.get('/api/auth/user', (_req, res) => {
    res.json({ user: null, note: 'Auth wired in step 5' })
  })

  app.post('/api/login', (_req, res) => {
    res.status(501).json({ error: 'Login not implemented yet (step 5)' })
  })

  app.post('/api/logout', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/bounty-posts', dbRequired, async (_req, res) => {
    res.json({ posts: await listBountyPosts() })
  })

  app.post('/api/bounty-posts', dbRequired, async (req, res) => {
    try {
      const clipId = Number(req.body?.clipId)
      const platform = String(req.body?.platform ?? '').toLowerCase()
      if (!clipId) {
        res.status(400).json({ error: 'clipId required' })
        return
      }
      if (platform !== 'x' && platform !== 'tiktok') {
        res.status(400).json({ error: 'platform must be x or tiktok' })
        return
      }
      const clip = await getClipById(clipId)
      if (!clip?.media_url) {
        res.status(400).json({ error: 'Clip must have rendered media before bounty queue' })
        return
      }
      const post = await queueBountyPost({
        clip_id: clipId,
        platform: platform as 'x' | 'tiktok',
        notes: req.body?.notes,
      })
      res.json({ ok: true, post })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.patch('/api/bounty-posts/:id', dbRequired, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) {
        res.status(400).json({ error: 'Invalid id' })
        return
      }
      if (req.body?.postUrl) {
        const post = await markBountyPosted({
          id,
          post_url: String(req.body.postUrl),
          posted_at: req.body?.postedAt ? new Date(req.body.postedAt) : undefined,
          views: req.body?.views != null ? Number(req.body.views) : undefined,
          engagement: req.body?.engagement != null ? Number(req.body.engagement) : undefined,
          notes: req.body?.notes,
        })
        res.json({ ok: true, post })
        return
      }
      const post = await updateBountyMetrics({
        id,
        views: req.body?.views != null ? Number(req.body.views) : undefined,
        engagement: req.body?.engagement != null ? Number(req.body.engagement) : undefined,
      })
      res.json({ ok: true, post })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/bounty-posts/:id/mark-posted', dbRequired, async (req, res) => {
    try {
      const id = Number(req.params.id)
      const postUrl = String(req.body?.postUrl ?? '')
      if (!id || !postUrl) {
        res.status(400).json({ error: 'postUrl required' })
        return
      }
      const post = await markBountyPosted({
        id,
        post_url: postUrl,
        posted_at: req.body?.postedAt ? new Date(req.body.postedAt) : undefined,
        views: req.body?.views != null ? Number(req.body.views) : undefined,
        engagement: req.body?.engagement != null ? Number(req.body.engagement) : undefined,
        notes: req.body?.notes,
      })
      res.json({ ok: true, post })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/api/bounty/clips', dbRequired, async (_req, res) => {
    res.json({ clips: await listBountyClips() })
  })

  app.get('/api/developers', dbRequired, async (_req, res) => {
    res.json({ developers: [], note: 'Developer CRM uses retainers table — step 6' })
  })

  app.get('/api/developers/pipeline', dbRequired, async (_req, res) => {
    res.json({ pipeline: [], note: 'Developer pipeline step 6' })
  })

  app.get('/api/sales', dbRequired, async (_req, res) => {
    res.json({ sales: await listSales(), stripeMode: stripeModeLabel() })
  })

  startTwitchMonitor()
}
