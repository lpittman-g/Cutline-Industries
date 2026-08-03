import express, { type Express, type Request, type Response } from 'express'
import path from 'node:path'
import { thermalDbEnabled } from './db/pool.ts'
import {
  countClipsToday,
  countLiveStreamers,
  listClips,
  listHeatEvents,
  listRecentHeatAlert,
  listStreamers,
  listTopClips,
  seedStreamersIfEmpty,
} from './db/thermalRepo.ts'
import { triggerHeatEvent } from './heatPipeline.ts'
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

  app.get('/api/dashboard/summary', dbRequired, async (_req, res) => {
    const alert = await listRecentHeatAlert()
    const clipsToday = await countClipsToday()
    const liveChannels = await countLiveStreamers()
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
      totalRevenueCents: 0,
      pendingOutreaches: 0,
    })
  })

  app.get('/api/dashboard/revenue-timeline', dbRequired, async (_req, res) => {
    res.json({ timeline: [], note: 'Sales ledger wired in step 2 (Stripe)' })
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
    res.json({ posts: [], note: 'Bounty distribution step 3' })
  })

  app.get('/api/developers', dbRequired, async (_req, res) => {
    res.json({ developers: [], note: 'Developer CRM uses retainers table — step 6' })
  })

  app.get('/api/developers/pipeline', dbRequired, async (_req, res) => {
    res.json({ pipeline: [], note: 'Developer pipeline step 6' })
  })

  app.get('/api/sales', dbRequired, async (_req, res) => {
    res.json({ sales: [], note: 'Sales ledger step 2' })
  })

  startTwitchMonitor()
}
