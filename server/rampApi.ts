import type { Express, Request, Response } from 'express'
import { randomBytes } from 'node:crypto'
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  getAccessToken,
  listTransactions,
  loadRampToken,
  rampConfigured,
  rampStatusPayload,
} from './rampClient.ts'

function sendError(res: Response, err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err)
  const grantHint = /not authorized to use this authorization grant type|DEVELOPER_7012/i.test(
    message,
  )
    ? 'In demo.ramp.com → Developer → your app, turn Client credentials (and/or Authorization code) back ON.'
    : undefined
  res.status(status).json({
    ok: false,
    error: message,
    hint: grantHint,
  })
}

export function registerRampRoutes(app: Express) {
  app.get('/api/ramp/status', async (_req, res) => {
    const stored = await loadRampToken()
    res.json({
      ok: true,
      ...rampStatusPayload(),
      hasStoredUserToken: Boolean(stored?.access_token),
      hasRefreshToken: Boolean(stored?.refresh_token),
    })
  })

  app.get('/api/ramp/transactions', async (req, res) => {
    if (!rampConfigured()) {
      res.status(503).json({
        ok: false,
        error: 'Ramp not configured',
        hint: 'Set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in .env',
      })
      return
    }
    try {
      const pageSize = Math.min(Number(req.query.page_size) || 25, 100)
      const maxPages = Math.min(Number(req.query.max_pages) || 2, 10)
      const auth = await getAccessToken()
      const result = await listTransactions({ pageSize, maxPages })
      const total = result.transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
      res.json({
        ok: true,
        ...rampStatusPayload(),
        authSource: auth.source,
        scope: auth.scope,
        count: result.transactions.length,
        pages: result.pages,
        next: result.next,
        totalAmount: Math.round(total * 100) / 100,
        transactions: result.transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          merchant_name: t.merchant_name,
          state: t.state,
          user_transaction_time: t.user_transaction_time,
          currency_code: t.currency_code ?? 'USD',
          card_holder: t.card_holder
            ? {
                name: [t.card_holder.first_name, t.card_holder.last_name]
                  .filter(Boolean)
                  .join(' '),
                department_name: t.card_holder.department_name,
              }
            : null,
        })),
      })
    } catch (err) {
      sendError(res, err, 502)
    }
  })

  app.get('/api/ramp/oauth/url', (req: Request, res: Response) => {
    if (!rampConfigured()) {
      res.status(503).json({
        ok: false,
        error: 'Ramp not configured',
        hint: 'Set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in .env',
      })
      return
    }
    const state =
      typeof req.query.state === 'string' && req.query.state
        ? req.query.state
        : randomBytes(16).toString('hex')
    res.json({
      ok: true,
      url: buildAuthorizeUrl(state),
      state,
      redirectUri: rampStatusPayload().redirectUri,
      env: rampStatusPayload().env,
    })
  })

  app.post('/api/ramp/oauth/exchange', async (req, res) => {
    if (!rampConfigured()) {
      res.status(503).json({
        ok: false,
        error: 'Ramp not configured',
        hint: 'Set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in .env',
      })
      return
    }
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!code) {
      res.status(400).json({ ok: false, error: 'code is required' })
      return
    }
    try {
      const token = await exchangeAuthorizationCode(code)
      res.json({
        ok: true,
        scope: token.scope,
        expires_in: token.expires_in,
        hasRefreshToken: Boolean(token.refresh_token),
        env: rampStatusPayload().env,
      })
    } catch (err) {
      sendError(res, err, 502)
    }
  })
}
