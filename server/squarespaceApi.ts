import type { Express, Response } from 'express'
import {
  getSquarespaceWebsite,
  listSquarespaceProducts,
  probeSquarespaceSitePublic,
  squarespaceConfigured,
  squarespaceStatusPayload,
} from './squarespaceClient.ts'

function sendError(res: Response, err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err)
  res.status(status).json({ ok: false, error: message })
}

export function registerSquarespaceRoutes(app: Express) {
  app.get('/api/squarespace/status', async (_req, res) => {
    const base = squarespaceStatusPayload()
    if (!squarespaceConfigured()) {
      res.json({
        ok: true,
        connected: false,
        ...base,
        hint: 'Set SQUARESPACE_API_KEY in .env (Squarespace → Developer tools → API keys)',
      })
      return
    }
    try {
      const [website, publicProbe] = await Promise.all([
        getSquarespaceWebsite(),
        probeSquarespaceSitePublic(),
      ])
      res.json({
        ok: true,
        connected: true,
        ...base,
        website: {
          id: website.id,
          siteId: website.siteId,
          title: website.title,
          url: website.url,
          currency: website.currency,
          language: website.language,
          timeZone: website.timeZone,
        },
        publicProbe,
      })
    } catch (err) {
      sendError(res, err, 502)
    }
  })

  app.get('/api/squarespace/products', async (req, res) => {
    if (!squarespaceConfigured()) {
      res.status(503).json({
        ok: false,
        error: 'Squarespace not configured',
        hint: 'Set SQUARESPACE_API_KEY in .env',
      })
      return
    }
    try {
      const limit = Number(req.query.limit) || 50
      const products = await listSquarespaceProducts(limit)
      res.json({
        ok: true,
        ...squarespaceStatusPayload(),
        count: products.length,
        products,
      })
    } catch (err) {
      sendError(res, err, 502)
    }
  })
}
