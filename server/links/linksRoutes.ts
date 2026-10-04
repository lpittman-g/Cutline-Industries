/**
 * Cutline Links — internal link shortener + analytics
 * Replaces dub.sh. Runs entirely inside the Artemis network.
 *
 * Redirect: GET /:slug  (mounted at root in createApp.ts before SPA catch-all)
 * API:      /api/links/*  (authenticated)
 */
import type { Express, Request, Response } from 'express'
import { requireAuth, requireRole } from '../auth/authMiddleware.ts'
import {
  createLink,
  deleteLink,
  getLink,
  getLinkAnalytics,
  getLinkById,
  listLinks,
  recordClick,
  updateLink,
} from './linksRepo.ts'

function detectDevice(ua: string): string {
  if (/bot|crawler|spider|preview/i.test(ua)) return 'bot'
  if (/mobile|android|iphone|ipad/i.test(ua)) return /ipad/i.test(ua) ? 'tablet' : 'mobile'
  return 'desktop'
}

function detectBrowser(ua: string): string {
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/edg\//i.test(ua)) return 'Edge'
  if (/chrome/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua)) return 'Safari'
  return 'Other'
}

function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad/i.test(ua)) return 'iOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Other'
}

function clientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    ''
  )
}

export function registerLinksRedirect(app: Express) {
  // Public redirect — must be registered before the SPA catch-all
  app.get('/l/:slug', async (req: Request, res: Response) => {
    try {
      const link = await getLink(req.params.slug)
      if (!link || link.archived) { res.status(404).send('Link not found'); return }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        res.status(410).send('Link expired')
        return
      }

      const ua = req.headers['user-agent'] || ''
      void recordClick(link.id, {
        device: detectDevice(ua),
        browser: detectBrowser(ua),
        os: detectOS(ua),
        referer: req.headers.referer || req.headers.referrer as string,
        ip: clientIp(req),
      }).catch(() => {})

      res.redirect(302, link.destination)
    } catch {
      res.status(500).send('Error')
    }
  })
}

export function registerLinksRoutes(app: Express) {
  // ── List links ───────────────────────────────────────────────────────────────
  app.get('/api/links', requireAuth, async (req: Request, res: Response) => {
    try {
      const links = await listLinks({
        projectId: req.query.projectId as string | undefined,
        tag: req.query.tag as string | undefined,
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      })
      res.json({ ok: true, links })
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) })
    }
  })

  // ── Create link ──────────────────────────────────────────────────────────────
  app.post('/api/links', requireAuth, async (req: Request, res: Response) => {
    try {
      const { destination, slug, title, tags, projectId, clipId, expiresAt } = req.body as Record<string, string>
      if (!destination) { res.status(400).json({ ok: false, error: 'destination required' }); return }

      const link = await createLink({
        destination,
        slug: slug?.trim() || undefined,
        title: title?.trim(),
        tags: Array.isArray(req.body.tags) ? req.body.tags : tags ? [tags] : [],
        projectId: projectId || undefined,
        clipId: clipId || undefined,
        createdBy: req.authUser?.id,
        expiresAt: expiresAt || undefined,
      })
      res.status(201).json({ ok: true, link })
    } catch (err) {
      const msg = String(err)
      if (msg.includes('unique')) res.status(409).json({ ok: false, error: 'Slug already taken' })
      else res.status(500).json({ ok: false, error: msg })
    }
  })

  // ── Get link ─────────────────────────────────────────────────────────────────
  app.get('/api/links/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const link = await getLinkById(req.params.id)
      if (!link) { res.status(404).json({ ok: false, error: 'not found' }); return }
      res.json({ ok: true, link })
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) })
    }
  })

  // ── Update link ──────────────────────────────────────────────────────────────
  app.patch('/api/links/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const link = await updateLink(req.params.id, req.body)
      if (!link) { res.status(404).json({ ok: false, error: 'not found' }); return }
      res.json({ ok: true, link })
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) })
    }
  })

  // ── Delete link ──────────────────────────────────────────────────────────────
  app.delete('/api/links/:id', requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const ok = await deleteLink(req.params.id)
      res.json({ ok })
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) })
    }
  })

  // ── Analytics ────────────────────────────────────────────────────────────────
  app.get('/api/links/:id/analytics', requireAuth, async (req: Request, res: Response) => {
    try {
      const link = await getLinkById(req.params.id)
      if (!link) { res.status(404).json({ ok: false, error: 'not found' }); return }
      const days = req.query.days ? Number(req.query.days) : 30
      const analytics = await getLinkAnalytics(req.params.id, days)
      res.json({ ok: true, link, analytics })
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) })
    }
  })
}
