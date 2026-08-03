import express, { type Express, type Request, type Response } from 'express'
import path from 'node:path'
import { thermalDbEnabled } from './db/pool.ts'
import {
  countClipsToday,
  countLiveStreamers,
  countPendingRetainerOutreaches,
  countQueuedBountyPosts,
  getBountyCaptionNotes,
  getClipById,
  resolveFulfillmentCaptions,
  getRetainerById,
  insertRetainer,
  isRetainerStatus,
  listBountyClips,
  listBountyPosts,
  listClips,
  listHeatEvents,
  listRecentHeatAlert,
  listRetainers,
  listSales,
  listStreamers,
  listTopClips,
  markBountyPosted,
  queueBountyPost,
  retainerPipelineCounts,
  revenueByTier,
  revenueTimeline,
  seedRetainersIfEmpty,
  seedStreamersIfEmpty,
  totalRevenueCents,
  updateBountyMetrics,
  updateRetainer,
} from './db/thermalRepo.ts'
import { triggerHeatEvent } from './heatPipeline.ts'
import { rerunClipAutopilot } from './thermalHeatAutopilot.ts'
import {
  confirmCheckoutSession,
  createCheckoutSession,
  createRetainerCheckoutSession,
  stripeConfigured,
  stripeModeLabel,
} from './stripeCheckout.ts'
import { requireRole } from './auth/authMiddleware.ts'
import { createPrivateDownloadUrl, s3Configured } from './s3Storage.ts'
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

function publicClip<T extends Record<string, unknown>>(clip: T) {
  const {
    s3_clean_url: _clean,
    stripe_checkout_session_id: _session,
    stripe_payment_link: _paymentLink,
    ...safe
  } = clip
  return safe
}

/**
 * Public URL for local (non-S3) paid clean downloads.
 * Heat pipeline writes under spike id: thermal_media/clips/{spikeId}/heat_clip.mp4
 * — never under clip id.
 */
export function localCleanDownloadUrl(clip: {
  spike_id?: number | null
  media_url?: string | null
  s3_clean_url?: string | null
}): string | null {
  const media = typeof clip.media_url === 'string' ? clip.media_url.trim() : ''
  if (media) {
    const fromWm = media.match(/^(\/thermal-media\/clips\/\d+\/)(.+)_wm(\.mp4)$/i)
    if (fromWm) return `${fromWm[1]}${fromWm[2]}${fromWm[3]}`
  }

  if (clip.spike_id && Number.isFinite(clip.spike_id) && clip.spike_id > 0) {
    return `/thermal-media/clips/${clip.spike_id}/heat_clip.mp4`
  }

  const clean = typeof clip.s3_clean_url === 'string' ? clip.s3_clean_url.trim() : ''
  if (clean && !clean.startsWith('s3://')) {
    const normalized = clean.replace(/\\/g, '/')
    const marker = '/thermal_media/'
    const idx = normalized.lastIndexOf(marker)
    if (idx >= 0) {
      return `/thermal-media/${normalized.slice(idx + marker.length)}`
    }
    const clipsMatch = normalized.match(/\/clips\/(\d+)\/([^/]+\.mp4)$/i)
    if (clipsMatch) return `/thermal-media/clips/${clipsMatch[1]}/${clipsMatch[2]}`
  }

  return null
}

export function registerThermalRoutes(app: Express) {
  const defaultVod = path.join(ROOT, 'inbox', 'cutline_test_vod.mp4')
  const ops = [dbRequired, requireRole('operator')] as const

  app.use('/thermal-media', expressStaticThermal)

  app.get('/api/streamers', dbRequired, async (_req, res) => {
    await seedStreamersIfEmpty(defaultVod)
    const streamers = await listStreamers()
    res.json({ streamers })
  })

  app.post('/api/streamers/sync', ...ops, async (_req, res) => {
    await seedStreamersIfEmpty(defaultVod)
    const result = await syncStreamersFromTwitch()
    res.json({ ok: true, ...result, streamers: await listStreamers() })
  })

  app.get('/api/heat-events', dbRequired, async (_req, res) => {
    res.json({ events: await listHeatEvents() })
  })

  app.post('/api/heat-events', ...ops, async (req, res) => {
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

  app.get('/api/clips', ...ops, async (_req, res) => {
    res.json({ clips: await listClips() })
  })

  app.get('/api/clips/top', ...ops, async (_req, res) => {
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
    res.json({ clip: publicClip(clip as unknown as Record<string, unknown>) })
  })

  app.post('/api/clips/:id/download', dbRequired, async (req, res) => {
    try {
      const id = Number(req.params.id)
      const sessionId = String(req.body?.sessionId ?? '')
      const clip = id ? await getClipById(id) : null
      if (!clip) {
        res.status(404).json({ error: 'Clip not found' })
        return
      }
      if (
        clip.status !== 'claimed' ||
        !sessionId ||
        clip.stripe_checkout_session_id !== sessionId
      ) {
        res.status(403).json({ error: 'Paid checkout session required' })
        return
      }
      const bountyCaptions = await getBountyCaptionNotes(id)
      const fulfillment = {
        captions: resolveFulfillmentCaptions(clip, bountyCaptions),
      }
      if (!s3Configured() || !clip.s3_clean_url?.startsWith('s3://')) {
        const url = localCleanDownloadUrl(clip)
        if (!url) {
          res.status(404).json({ error: 'Clean media not available locally' })
          return
        }
        res.json({
          ok: true,
          url,
          storage: 'local',
          ...fulfillment,
        })
        return
      }
      res.json({
        ok: true,
        url: await createPrivateDownloadUrl(clip.s3_clean_url),
        storage: 's3',
        expiresIn: 900,
        ...fulfillment,
      })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /** Re-run AI copy + Discord / bounty / pitch for a rendered clip (no FFmpeg re-cut). */
  app.post('/api/clips/:id/autopilot', ...ops, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) {
        res.status(400).json({ error: 'Invalid clip id' })
        return
      }
      const result = await rerunClipAutopilot(id)
      const clip = await getClipById(id)
      res.json({
        ok: true,
        autopilot: result,
        clip: clip ? publicClip(clip as unknown as Record<string, unknown>) : null,
      })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
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

  app.get('/api/dashboard/summary', ...ops, async (_req, res) => {
    const alert = await listRecentHeatAlert()
    const clipsToday = await countClipsToday()
    const liveChannels = await countLiveStreamers()
    const revenueCents = await totalRevenueCents()
    const pendingBounty = await countQueuedBountyPosts()
    const pendingRetainers = await countPendingRetainerOutreaches()
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
      pendingOutreaches: pendingBounty + pendingRetainers,
      stripeMode: stripeModeLabel(),
    })
  })

  app.get('/api/dashboard/revenue-timeline', ...ops, async (req, res) => {
    const days = Number(req.query.days ?? 30)
    res.json({
      timeline: await revenueTimeline(Number.isFinite(days) ? days : 30),
      byTier: await revenueByTier(),
    })
  })

  app.get('/api/bounty-posts', ...ops, async (_req, res) => {
    res.json({ posts: await listBountyPosts() })
  })

  app.post('/api/bounty-posts', ...ops, async (req, res) => {
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

  app.patch('/api/bounty-posts/:id', ...ops, async (req, res) => {
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

  app.post('/api/bounty-posts/:id/mark-posted', ...ops, async (req, res) => {
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
    const clips = await listBountyClips()
    res.json({
      clips: clips.map((clip) => publicClip(clip as unknown as Record<string, unknown>)),
    })
  })

  app.get('/api/developers', ...ops, async (_req, res) => {
    await seedRetainersIfEmpty()
    res.json({ developers: await listRetainers() })
  })

  app.get('/api/developers/pipeline', ...ops, async (_req, res) => {
    await seedRetainersIfEmpty()
    res.json({ pipeline: await retainerPipelineCounts() })
  })

  /** Public onboarding: create prospect + Stripe subscription checkout in one step. */
  app.post('/api/developers/checkout', dbRequired, async (req, res) => {
    if (!stripeConfigured()) {
      res.status(503).json({
        error: 'Stripe not configured',
        hint: 'Set STRIPE_SECRET_KEY in environment',
      })
      return
    }
    try {
      const devName = String(req.body?.devName ?? '').trim()
      const gameTitle = String(req.body?.gameTitle ?? '').trim()
      if (!devName || !gameTitle) {
        res.status(400).json({ error: 'devName and gameTitle required' })
        return
      }
      const monthlyMrr = req.body?.monthlyMrr != null ? Number(req.body.monthlyMrr) : 750
      if (!Number.isFinite(monthlyMrr) || monthlyMrr < 750) {
        res.status(400).json({ error: 'monthlyMrr must be >= 750' })
        return
      }
      const developer = await insertRetainer({
        dev_name: devName,
        game_title: gameTitle,
        monthly_mrr: monthlyMrr,
        contact_email: req.body?.contactEmail ? String(req.body.contactEmail).trim() : null,
        notes: req.body?.notes ? String(req.body.notes).trim() : null,
        status: 'prospect',
      })
      const session = await createRetainerCheckoutSession({
        retainerId: developer.id,
        monthlyMrrOverride: monthlyMrr,
      })
      res.json({ ok: true, developer, ...session })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/developers', ...ops, async (req, res) => {
    try {
      const devName = String(req.body?.devName ?? '').trim()
      const gameTitle = String(req.body?.gameTitle ?? '').trim()
      if (!devName || !gameTitle) {
        res.status(400).json({ error: 'devName and gameTitle required' })
        return
      }
      const statusRaw = req.body?.status ? String(req.body.status) : 'prospect'
      if (!isRetainerStatus(statusRaw)) {
        res.status(400).json({
          error: 'status must be prospect, sample_sent, active, or cancelled',
        })
        return
      }
      const monthlyMrr = req.body?.monthlyMrr != null ? Number(req.body.monthlyMrr) : 750
      if (!Number.isFinite(monthlyMrr) || monthlyMrr < 750) {
        res.status(400).json({ error: 'monthlyMrr must be >= 750' })
        return
      }
      const developer = await insertRetainer({
        dev_name: devName,
        game_title: gameTitle,
        monthly_mrr: monthlyMrr,
        contact_email: req.body?.contactEmail ? String(req.body.contactEmail).trim() : null,
        notes: req.body?.notes ? String(req.body.notes).trim() : null,
        sample_clip_id: req.body?.sampleClipId ? Number(req.body.sampleClipId) : null,
        status: statusRaw,
      })
      res.json({ ok: true, developer })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/api/developers/:id', ...ops, async (req, res) => {
    const id = Number(req.params.id)
    if (!id) {
      res.status(400).json({ error: 'Invalid retainer id' })
      return
    }
    const developer = await getRetainerById(id)
    if (!developer) {
      res.status(404).json({ error: 'Retainer not found' })
      return
    }
    res.json({ developer })
  })

  app.patch('/api/developers/:id', ...ops, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) {
        res.status(400).json({ error: 'Invalid retainer id' })
        return
      }
      const statusRaw = req.body?.status != null ? String(req.body.status) : undefined
      if (statusRaw != null && !isRetainerStatus(statusRaw)) {
        res.status(400).json({
          error: 'status must be prospect, sample_sent, active, or cancelled',
        })
        return
      }
      const monthlyMrr =
        req.body?.monthlyMrr != null ? Number(req.body.monthlyMrr) : undefined
      if (monthlyMrr != null && (!Number.isFinite(monthlyMrr) || monthlyMrr < 750)) {
        res.status(400).json({ error: 'monthlyMrr must be >= 750' })
        return
      }
      const developer = await updateRetainer(id, {
        status: statusRaw && isRetainerStatus(statusRaw) ? statusRaw : undefined,
        monthly_mrr: monthlyMrr,
        contact_email:
          req.body?.contactEmail !== undefined
            ? String(req.body.contactEmail || '').trim() || null
            : undefined,
        notes:
          req.body?.notes !== undefined ? String(req.body.notes || '').trim() || null : undefined,
        sample_clip_id:
          req.body?.sampleClipId !== undefined
            ? req.body.sampleClipId
              ? Number(req.body.sampleClipId)
              : null
            : undefined,
        dev_name: req.body?.devName ? String(req.body.devName).trim() : undefined,
        game_title: req.body?.gameTitle ? String(req.body.gameTitle).trim() : undefined,
      })
      if (!developer) {
        res.status(404).json({ error: 'Retainer not found' })
        return
      }
      res.json({ ok: true, developer })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/developers/:id/checkout', ...ops, async (req, res) => {
    if (!stripeConfigured()) {
      res.status(503).json({
        error: 'Stripe not configured',
        hint: 'Set STRIPE_SECRET_KEY in environment',
      })
      return
    }
    try {
      const id = Number(req.params.id)
      if (!id) {
        res.status(400).json({ error: 'Invalid retainer id' })
        return
      }
      const monthlyMrr =
        req.body?.monthlyMrr != null ? Number(req.body.monthlyMrr) : undefined
      const session = await createRetainerCheckoutSession({
        retainerId: id,
        monthlyMrrOverride: monthlyMrr,
      })
      res.json({ ok: true, ...session })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/api/sales', ...ops, async (_req, res) => {
    res.json({ sales: await listSales(), stripeMode: stripeModeLabel() })
  })

  startTwitchMonitor()
}
