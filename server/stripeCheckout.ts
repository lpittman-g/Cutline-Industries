import type { Express, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import {
  activateRetainer,
  claimClip,
  CLIP_CHECKOUT_LOCK_CLASS,
  ClipAlreadyClaimedError,
  getRetainerById,
  insertPendingSale,
  markSaleLostClaimRace,
  setRetainerCheckoutSession,
} from './db/thermalRepo.ts'
import { withClient } from './db/pool.ts'
import { publicBaseUrl } from './auth/authCrypto.ts'
import type { ClipWithMeta, SaleTier } from './db/thermalTypes.ts'
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
        throw new ClipAlreadyClaimedError(
          clip.id,
          (clip.stripe_checkout_session_id as string | null | undefined) ?? null,
        )
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

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null
}

/** Losing buyer paid after another claim won — ledger + best-effort Stripe refund. */
export async function handleLostClaimRace(session: Stripe.Checkout.Session) {
  const paymentIntentId = paymentIntentIdFromSession(session)
  const sale = await markSaleLostClaimRace({
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  })

  if (!paymentIntentId) {
    return { sale, refunded: false as const, reason: 'no_payment_intent' as const }
  }
  if (process.env.CUTLINE_DRY_RUN === '1') {
    console.warn('[stripe] dry-run: skip refund for lost claim race', {
      sessionId: session.id,
      paymentIntentId,
    })
    return { sale, refunded: false as const, reason: 'dry_run' as const }
  }

  try {
    const refund = await getStripe().refunds.create({
      payment_intent: paymentIntentId,
      reason: 'duplicate',
      metadata: {
        clip_id: String(session.metadata?.clip_id ?? ''),
        lost_claim_race: '1',
      },
    })
    return { sale, refunded: true as const, refundId: refund.id }
  } catch (err) {
    console.error('[stripe] lost-claim refund failed', {
      sessionId: session.id,
      paymentIntentId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { sale, refunded: false as const, reason: 'stripe_error' as const }
  }
}

export async function createRetainerCheckoutSession(input: {
  retainerId: number
  monthlyMrrOverride?: number
}) {
  const retainer = await getRetainerById(input.retainerId)
  if (!retainer) throw new Error('Retainer not found')
  if (retainer.status === 'active' && retainer.stripe_subscription_id) {
    throw new Error('Retainer already active')
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

  await setRetainerCheckoutSession(retainer.id, session.id)
  await insertPendingSale({
    clip_id: null,
    tier: 'retainer',
    amount_cents: amountCents,
    stripe_checkout_session_id: session.id,
    metadata: {
      retainer_id: retainer.id,
      dev_name: retainer.dev_name,
      game_title: retainer.game_title,
    },
  })

  return { url: session.url, sessionId: session.id, tier: 'retainer' as const, amountCents }
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
        try {
          await fulfillCheckoutSession(session)
        } catch (err) {
          // Lost claim race: mark loser refunded, best-effort Stripe refund, ack webhook.
          if (err instanceof ClipAlreadyClaimedError) {
            const refund = await handleLostClaimRace(session)
            console.warn('[stripe] clip already claimed; acknowledging webhook', {
              clipId: err.clipId,
              existingSessionId: err.existingSessionId,
              refunded: refund.refunded,
            })
            res.json({
              received: true,
              skipped: 'clip_already_claimed',
              refunded: refund.refunded,
            })
            return
          }
          throw err
        }
      }
    }
    res.json({ received: true })
  } catch (err) {
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
      await handleLostClaimRace(session)
      throw err
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
