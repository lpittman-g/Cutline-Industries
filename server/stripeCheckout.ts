import type { Express, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import {
  activateRetainer,
  claimClip,
  CLIP_CHECKOUT_LOCK_CLASS,
  ClipAlreadyClaimedError,
  markSaleLostClaimRace,
  RETAINER_CHECKOUT_LOCK_CLASS,
  RetainerAlreadyActiveError,
  type ClipWithMeta,
} from './db/thermalRepo.ts'
import { withClient } from './db/pool.ts'
import { publicBaseUrl } from './auth/authCrypto.ts'
import type { RetainerRow, SaleTier } from './db/thermalTypes.ts'
import { ROOT } from './youtubeAuth.ts'

const TIER_AMOUNTS: Record<SaleTier, number> = {
  gateway: 1500,
  bounty: 5000,
  retainer: 75000,
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

function tierForClip(clipTier: string | undefined, override?: string): SaleTier {
  if (override === 'gateway' || override === 'bounty') return override
  if (clipTier === 'bounty') return 'bounty'
  return 'gateway'
}

function amountForTier(tier: SaleTier, overrideCents?: number) {
  if (overrideCents && Number.isFinite(overrideCents) && overrideCents > 0) {
    return Math.round(overrideCents)
  }
  if (tier === 'gateway' && process.env.STRIPE_GATEWAY_AMOUNT_CENTS) {
    return Number(process.env.STRIPE_GATEWAY_AMOUNT_CENTS)
  }
  if (tier === 'bounty' && process.env.STRIPE_BOUNTY_AMOUNT_CENTS) {
    return Number(process.env.STRIPE_BOUNTY_AMOUNT_CENTS)
  }
  if (tier === 'retainer' && process.env.STRIPE_RETAINER_AMOUNT_CENTS) {
    return Number(process.env.STRIPE_RETAINER_AMOUNT_CENTS)
  }
  return TIER_AMOUNTS[tier]
}

function priceIdForTier(tier: SaleTier): string | null {
  if (tier === 'gateway') return process.env.STRIPE_PRICE_GATEWAY?.trim() || null
  if (tier === 'bounty') return process.env.STRIPE_PRICE_BOUNTY?.trim() || null
  return process.env.STRIPE_PRICE_RETAINER?.trim() || null
}

export async function createCheckoutSession(input: {
  clipId: number
  tierOverride?: string
}) {
  // Hold a transaction + advisory lock across Stripe session create so two
  // buyers cannot both mint checkout URLs for the same unclaimed clip.
  return withClient(async (client) => {
    await client.query('BEGIN')
    let createdSessionId: string | null = null
    try {
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [
        CLIP_CHECKOUT_LOCK_CLASS,
        input.clipId,
      ])
      const locked = await client.query(`SELECT * FROM clips WHERE id = $1 FOR UPDATE`, [
        input.clipId,
      ])
      const row = locked.rows[0] as Record<string, unknown> | undefined
      if (!row) throw new Error('Clip not found')
      const clip = row as unknown as ClipWithMeta
      if (clip.status === 'claimed') {
        throw new ClipAlreadyClaimedError(clip.id, clip.stripe_checkout_session_id ?? null)
      }

      const tier = tierForClip(clip.tier, input.tierOverride)
      const amountCents = amountForTier(tier)
      const stripe = getStripe()
      const base = publicBaseUrl()
      const title = clip.title ?? `Thermal clip #${clip.id}`

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
      const priceId = priceIdForTier(tier)
      if (priceId) {
        lineItems.push({ price: priceId, quantity: 1 })
      } else {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: tier === 'bounty' ? `Thermal Bounty — ${title}` : `Thermal Gateway — ${title}`,
              description: `@${clip.streamer_username ?? 'streamer'} · ${clip.game ?? 'game'}`,
            },
          },
          quantity: 1,
        })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        success_url: `${base}/checkout/${clip.id}?session_id={CHECKOUT_SESSION_ID}&paid=1&tier=${tier}`,
        cancel_url: `${base}/checkout/${clip.id}?canceled=1&tier=${tier}`,
        client_reference_id: String(clip.id),
        metadata: {
          clip_id: String(clip.id),
          tier,
          streamer: clip.streamer_username ?? '',
          game: clip.game ?? '',
        },
      })

      if (!session.url) throw new Error('Stripe did not return checkout URL')
      createdSessionId = session.id

      await client.query(
        `UPDATE clips SET stripe_checkout_session_id = $2 WHERE id = $1`,
        [clip.id, session.id],
      )
      await client.query(
        `INSERT INTO sales (clip_id, tier, amount_cents, stripe_checkout_session_id, status, metadata)
         VALUES ($1, $2, $3, $4, 'pending', $5)`,
        [
          clip.id,
          tier,
          amountCents,
          session.id,
          JSON.stringify({
            title,
            streamer: clip.streamer_username,
            game: clip.game,
          }),
        ],
      )
      await client.query('COMMIT')
      return { url: session.url, sessionId: session.id, tier, amountCents }
    } catch (err) {
      await client.query('ROLLBACK')
      if (createdSessionId && process.env.CUTLINE_DRY_RUN !== '1') {
        try {
          await getStripe().checkout.sessions.expire(createdSessionId)
        } catch (expireErr) {
          console.warn('[stripe] failed to expire orphan checkout session', {
            sessionId: createdSessionId,
            error: expireErr instanceof Error ? expireErr.message : String(expireErr),
          })
        }
      }
      throw err
    }
  })
}

export async function createRetainerCheckoutSession(input: {
  retainerId: number
  monthlyMrrOverride?: number
}) {
  // Hold a transaction + advisory lock across Stripe session create so two
  // buyers cannot both mint subscription checkout URLs for the same retainer.
  return withClient(async (client) => {
    await client.query('BEGIN')
    let createdSessionId: string | null = null
    try {
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [
        RETAINER_CHECKOUT_LOCK_CLASS,
        input.retainerId,
      ])
      const locked = await client.query(
        `SELECT * FROM retainers WHERE id = $1 FOR UPDATE`,
        [input.retainerId],
      )
      const row = locked.rows[0] as Record<string, unknown> | undefined
      if (!row) throw new Error('Retainer not found')
      const retainer = row as unknown as RetainerRow

      if (retainer.status === 'active' && retainer.stripe_subscription_id) {
        throw new RetainerAlreadyActiveError(
          retainer.id,
          retainer.stripe_checkout_session_id ?? null,
        )
      }
      if (retainer.status === 'cancelled') {
        throw new Error('Retainer is cancelled — create a new prospect')
      }

      const mrrUsd = input.monthlyMrrOverride ?? Number(retainer.monthly_mrr)
      const amountCents = amountForTier(
        'retainer',
        Number.isFinite(mrrUsd) ? Math.round(mrrUsd * 100) : undefined,
      )
      const stripe = getStripe()
      const base = publicBaseUrl()
      const productName = `Thermal Indie Retainer — ${retainer.game_title}`

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
      const priceId = priceIdForTier('retainer')
      if (priceId) {
        lineItems.push({ price: priceId, quantity: 1 })
      } else {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            recurring: { interval: 'month' },
            product_data: {
              name: productName,
              description: `${retainer.dev_name} · monthly TikTok/Shorts wishlist packs`,
            },
          },
          quantity: 1,
        })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: lineItems,
        success_url: `${base}/developers?session_id={CHECKOUT_SESSION_ID}&retainer=${retainer.id}&paid=1`,
        cancel_url: `${base}/developers?canceled=1&retainer=${retainer.id}`,
        client_reference_id: `retainer:${retainer.id}`,
        customer_email: retainer.contact_email ?? undefined,
        metadata: {
          retainer_id: String(retainer.id),
          tier: 'retainer',
          dev_name: retainer.dev_name,
          game_title: retainer.game_title,
        },
      })

      if (!session.url) throw new Error('Stripe did not return checkout URL')
      createdSessionId = session.id

      await client.query(
        `UPDATE retainers
         SET stripe_checkout_session_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [retainer.id, session.id],
      )
      await client.query(
        `INSERT INTO sales (clip_id, tier, amount_cents, stripe_checkout_session_id, status, metadata)
         VALUES ($1, $2, $3, $4, 'pending', $5)`,
        [
          null,
          'retainer',
          amountCents,
          session.id,
          JSON.stringify({
            retainer_id: retainer.id,
            dev_name: retainer.dev_name,
            game_title: retainer.game_title,
          }),
        ],
      )
      await client.query('COMMIT')
      return {
        url: session.url,
        sessionId: session.id,
        tier: 'retainer' as const,
        amountCents,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      if (createdSessionId && process.env.CUTLINE_DRY_RUN !== '1') {
        try {
          await getStripe().checkout.sessions.expire(createdSessionId)
        } catch (expireErr) {
          console.warn('[stripe] failed to expire orphan retainer checkout session', {
            sessionId: createdSessionId,
            error: expireErr instanceof Error ? expireErr.message : String(expireErr),
          })
        }
      }
      throw err
    }
  })
}

async function fulfillClipCheckoutSession(session: Stripe.Checkout.Session) {
  const clipId = Number(session.metadata?.clip_id ?? session.client_reference_id)
  if (!clipId) throw new Error('Missing clip_id in checkout session')

  const amountCents =
    session.amount_total ??
    amountForTier((session.metadata?.tier as SaleTier) || 'gateway')

  await claimClip({
    clipId,
    saleAmountCents: amountCents,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    buyerEmail: session.customer_details?.email ?? session.customer_email ?? null,
  })
}

async function fulfillRetainerCheckoutSession(session: Stripe.Checkout.Session) {
  const retainerId = Number(
    session.metadata?.retainer_id ??
      String(session.client_reference_id ?? '').replace(/^retainer:/, ''),
  )
  if (!retainerId) throw new Error('Missing retainer_id in checkout session')

  const amountCents = session.amount_total ?? amountForTier('retainer')
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null

  await activateRetainer({
    retainerId,
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
    saleAmountCents: amountCents,
    buyerEmail: session.customer_details?.email ?? session.customer_email ?? null,
  })

  return retainerId
}

async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const tier = session.metadata?.tier
  if (tier === 'retainer' || session.mode === 'subscription') {
    await fulfillRetainerCheckoutSession(session)
    return
  }
  await fulfillClipCheckoutSession(session)
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === 'string') return session.payment_intent
  return session.payment_intent?.id ?? null
}

function subscriptionId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.subscription === 'string') return session.subscription
  return session.subscription?.id ?? null
}

/** True when Stripe reports the PaymentIntent/charge was already refunded. */
export function isAlreadyRefundedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''
  return (
    code === 'charge_already_refunded' ||
    /already (been )?refunded|charge_already_refunded/i.test(msg)
  )
}

/**
 * Losing buyer paid after another claim won — Stripe refund then ledger update.
 * Marks sale `refunded` only when the refund succeeded (or was already refunded);
 * otherwise `failed` so ops can retry. Skips Stripe calls when `CUTLINE_DRY_RUN=1`.
 */
export async function resolveLostClaimRace(
  err: ClipAlreadyClaimedError,
  session: Stripe.Checkout.Session,
): Promise<{
  refunded: boolean
  saleStatus: 'refunded' | 'failed'
  reason?: string
  refundId?: string
}> {
  const pi = paymentIntentId(session)
  const mark = (status: 'refunded' | 'failed') =>
    markSaleLostClaimRace({
      stripeCheckoutSessionId: session.id,
      winningSessionId: err.existingSessionId,
      stripePaymentIntentId: pi,
      refundReason: 'clip_already_claimed',
      status,
    })

  if (!pi) {
    await mark('failed')
    return { refunded: false, saleStatus: 'failed', reason: 'no_payment_intent' }
  }

  if (process.env.CUTLINE_DRY_RUN === '1') {
    console.warn('[stripe] dry-run: skip refund for lost claim race', {
      clipId: err.clipId,
      sessionId: session.id,
      paymentIntentId: pi,
    })
    await mark('refunded')
    return { refunded: false, saleStatus: 'refunded', reason: 'dry_run' }
  }

  try {
    const refund = await getStripe().refunds.create({
      payment_intent: pi,
      reason: 'duplicate',
      metadata: {
        clip_id: String(err.clipId),
        lost_claim_race: '1',
      },
    })
    await mark('refunded')
    return { refunded: true, saleStatus: 'refunded', refundId: refund.id }
  } catch (refundErr) {
    if (isAlreadyRefundedError(refundErr)) {
      await mark('refunded')
      return { refunded: true, saleStatus: 'refunded', reason: 'already_refunded' }
    }
    console.error('[stripe] lost-claim refund failed', {
      clipId: err.clipId,
      sessionId: session.id,
      paymentIntentId: pi,
      error: refundErr instanceof Error ? refundErr.message : String(refundErr),
    })
    await mark('failed')
    return { refunded: false, saleStatus: 'failed', reason: 'stripe_error' }
  }
}

/** Alias used by preferred draft #88 tests/docs. */
export const handleLostClaimRace = async (session: Stripe.Checkout.Session) => {
  const clipId = Number(session.metadata?.clip_id ?? session.client_reference_id)
  return resolveLostClaimRace(
    new ClipAlreadyClaimedError(clipId || 0, null),
    session,
  )
}

/**
 * Losing retainer checkout paid after another activate won — cancel/refund
 * first, then mark sale `refunded` or `failed` from the Stripe outcome.
 */
export async function resolveLostRetainerRace(
  err: RetainerAlreadyActiveError,
  session: Stripe.Checkout.Session,
): Promise<{
  cancelled: boolean
  refunded: boolean
  saleStatus: 'refunded' | 'failed'
  reason?: string
}> {
  const pi = paymentIntentId(session)
  const subId = subscriptionId(session)
  const mark = (status: 'refunded' | 'failed') =>
    markSaleLostClaimRace({
      stripeCheckoutSessionId: session.id,
      winningSessionId: err.existingSessionId,
      stripePaymentIntentId: pi,
      refundReason: 'retainer_already_active',
      status,
    })

  if (process.env.CUTLINE_DRY_RUN === '1') {
    console.warn('[stripe] dry-run: skip cancel/refund for lost retainer race', {
      retainerId: err.retainerId,
      sessionId: session.id,
      subscriptionId: subId,
      paymentIntentId: pi,
    })
    await mark('refunded')
    return {
      cancelled: false,
      refunded: false,
      saleStatus: 'refunded',
      reason: 'dry_run',
    }
  }

  let cancelled = false
  let refunded = false
  let stripeError = false
  const stripe = getStripe()

  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId)
      cancelled = true
    } catch (cancelErr) {
      stripeError = true
      console.error('[stripe] lost-retainer subscription cancel failed', {
        retainerId: err.retainerId,
        sessionId: session.id,
        subscriptionId: subId,
        error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
      })
    }
  }

  if (pi) {
    try {
      await stripe.refunds.create({
        payment_intent: pi,
        reason: 'duplicate',
        metadata: {
          retainer_id: String(err.retainerId),
          lost_retainer_race: '1',
        },
      })
      refunded = true
    } catch (refundErr) {
      if (isAlreadyRefundedError(refundErr)) {
        refunded = true
      } else {
        stripeError = true
        console.error('[stripe] lost-retainer refund failed', {
          retainerId: err.retainerId,
          sessionId: session.id,
          paymentIntentId: pi,
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        })
      }
    }
  } else if (!cancelled) {
    // No payment intent and no cancel — nothing to settle; mark failed for ops.
    await mark('failed')
    return {
      cancelled: false,
      refunded: false,
      saleStatus: 'failed',
      reason: 'no_payment_intent',
    }
  }

  const saleStatus: 'refunded' | 'failed' =
    refunded || (cancelled && !stripeError) ? 'refunded' : 'failed'
  await mark(saleStatus)

  return {
    cancelled,
    refunded,
    saleStatus,
    reason: cancelled || refunded ? 'ok' : 'stripe_error',
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' })
    return
  }

  const sig = req.headers['stripe-signature']
  if (!sig || typeof sig !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' })
    return
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, secret)
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Webhook signature verification failed',
    })
    return
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      // Subscriptions may report payment_status unpaid briefly; paid or no_payment_required OK
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        await fulfillCheckoutSession(session)
      }
    }
    res.json({ received: true })
  } catch (err) {
    const session =
      event.type === 'checkout.session.completed'
        ? (event.data.object as Stripe.Checkout.Session)
        : null

    // Lost claim race: payment already fulfilled for another session — ack so Stripe stops retrying.
    if (err instanceof ClipAlreadyClaimedError) {
      let refunded = false
      let saleStatus: 'refunded' | 'failed' = 'failed'
      if (session) {
        const resolved = await resolveLostClaimRace(err, session).catch((resolveErr) => {
          console.error('[stripe] lost-claim resolution failed', resolveErr)
          return { refunded: false, saleStatus: 'failed' as const }
        })
        refunded = resolved.refunded
        saleStatus = resolved.saleStatus
      }
      console.warn('[stripe] clip already claimed; acknowledging webhook', {
        clipId: err.clipId,
        existingSessionId: err.existingSessionId,
        refunded,
        saleStatus,
      })
      res.json({ received: true, skipped: 'clip_already_claimed', refunded, saleStatus })
      return
    }

    // Lost retainer activate race: cancel/refund loser and ack.
    if (err instanceof RetainerAlreadyActiveError) {
      let cancelled = false
      let refunded = false
      let saleStatus: 'refunded' | 'failed' = 'failed'
      if (session) {
        const resolved = await resolveLostRetainerRace(err, session).catch((resolveErr) => {
          console.error('[stripe] lost-retainer resolution failed', resolveErr)
          return {
            cancelled: false,
            refunded: false,
            saleStatus: 'failed' as const,
          }
        })
        cancelled = resolved.cancelled
        refunded = resolved.refunded
        saleStatus = resolved.saleStatus
      }
      console.warn('[stripe] retainer already active; acknowledging webhook', {
        retainerId: err.retainerId,
        existingSessionId: err.existingSessionId,
        cancelled,
        refunded,
        saleStatus,
      })
      res.json({
        received: true,
        skipped: 'retainer_already_active',
        cancelled,
        refunded,
        saleStatus,
      })
      return
    }

    console.error('[stripe] webhook handler error', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}

/** Must register before express.json() — Stripe needs raw body. */
export function registerStripeWebhookRoute(app: Express) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      void handleStripeWebhook(req, res)
    },
  )
}

/** Dev fallback when webhook secret unavailable — verify session via API. */
export async function confirmCheckoutSession(sessionId: string) {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const paid =
    session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
  if (!paid) {
    return { ok: false as const, status: session.payment_status }
  }
  try {
    await fulfillCheckoutSession(session)
  } catch (err) {
    if (err instanceof ClipAlreadyClaimedError) {
      const { refunded, saleStatus } = await resolveLostClaimRace(err, session)
      return {
        ok: false as const,
        status: 'clip_already_claimed' as const,
        clipId: err.clipId,
        existingSessionId: err.existingSessionId,
        refunded,
        saleStatus,
      }
    }
    if (err instanceof RetainerAlreadyActiveError) {
      const { cancelled, refunded, saleStatus } = await resolveLostRetainerRace(
        err,
        session,
      )
      return {
        ok: false as const,
        status: 'retainer_already_active' as const,
        retainerId: err.retainerId,
        existingSessionId: err.existingSessionId,
        cancelled,
        refunded,
        saleStatus,
      }
    }
    throw err
  }
  if (session.metadata?.tier === 'retainer' || session.mode === 'subscription') {
    const retainerId = Number(
      session.metadata?.retainer_id ??
        String(session.client_reference_id ?? '').replace(/^retainer:/, ''),
    )
    return { ok: true as const, retainerId, tier: 'retainer' as const }
  }
  return {
    ok: true as const,
    clipId: Number(session.metadata?.clip_id ?? session.client_reference_id),
    tier: (session.metadata?.tier as SaleTier) || 'gateway',
  }
}

export function stripeModeLabel() {
  if (!stripeConfigured()) return 'mock'
  if (process.env.STRIPE_WEBHOOK_SECRET?.trim()) return 'live'
  return 'checkout-only'
}

export { ROOT, TIER_AMOUNTS, amountForTier, tierForClip }
