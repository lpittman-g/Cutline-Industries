import type { Express, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import {
  activateRetainer,
  attachClipCheckoutSession,
  claimClip,
  ClipAlreadyClaimedError,
  getClipById,
  getRetainerById,
  insertPendingSale,
  markSaleStatusByCheckoutSession,
  setRetainerCheckoutSession,
} from './db/thermalRepo.ts'
import { publicBaseUrl } from './auth/authCrypto.ts'
import type { SaleTier } from './db/thermalTypes.ts'
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

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === 'string') return session.payment_intent
  return session.payment_intent?.id ?? null
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
 * Losing concurrent checkout: refund the paid session and mark the sale
 * refunded (or failed if Stripe refund cannot be created).
 */
export async function refundLostClaimCheckout(session: Stripe.Checkout.Session): Promise<{
  saleStatus: 'refunded' | 'failed'
  paymentIntentId: string | null
}> {
  const stripe = getStripe()
  const paymentIntentId = paymentIntentIdFromSession(session)
  let saleStatus: 'refunded' | 'failed' = 'failed'

  if (paymentIntentId) {
    try {
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'duplicate',
      })
      saleStatus = 'refunded'
    } catch (err) {
      if (isAlreadyRefundedError(err)) {
        saleStatus = 'refunded'
      } else {
        console.error('[stripe] lost-claim refund failed', {
          sessionId: session.id,
          paymentIntentId,
          err,
        })
        saleStatus = 'failed'
      }
    }
  } else {
    console.warn('[stripe] lost-claim race with no payment_intent; marking sale failed', {
      sessionId: session.id,
    })
  }

  await markSaleStatusByCheckoutSession(session.id, saleStatus, paymentIntentId)
  return { saleStatus, paymentIntentId }
}

export async function createCheckoutSession(input: {
  clipId: number
  tierOverride?: string
}) {
  const clip = await getClipById(input.clipId)
  if (!clip) throw new Error('Clip not found')
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

  try {
    // Row-lock attach closes the TOCTOU gap between read and Stripe session create.
    await attachClipCheckoutSession(clip.id, session.id)
  } catch (err) {
    if (err instanceof ClipAlreadyClaimedError) {
      try {
        await stripe.checkout.sessions.expire(session.id)
      } catch (expireErr) {
        console.warn('[stripe] failed to expire orphan checkout session', {
          sessionId: session.id,
          expireErr,
        })
      }
    }
    throw err
  }

  await insertPendingSale({
    clip_id: clip.id,
    tier,
    amount_cents: amountCents,
    stripe_checkout_session_id: session.id,
    metadata: { title, streamer: clip.streamer_username, game: clip.game },
  })

  return { url: session.url, sessionId: session.id, tier, amountCents }
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
          // Lost claim race: refund loser, mark sale, ack so Stripe stops retrying.
          if (err instanceof ClipAlreadyClaimedError) {
            const refund = await refundLostClaimCheckout(session)
            console.warn('[stripe] clip already claimed; refunded losing checkout', {
              clipId: err.clipId,
              existingSessionId: err.existingSessionId,
              sessionId: session.id,
              saleStatus: refund.saleStatus,
            })
            res.json({
              received: true,
              skipped: 'clip_already_claimed',
              saleStatus: refund.saleStatus,
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
      const refund = await refundLostClaimCheckout(session)
      return {
        ok: false as const,
        error: 'clip_already_claimed' as const,
        clipId: err.clipId,
        existingSessionId: err.existingSessionId,
        saleStatus: refund.saleStatus,
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
