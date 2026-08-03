import type { Express, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import {
  activateRetainer,
  claimClip,
  ClipAlreadyClaimedError,
  getClipById,
  getRetainerById,
  insertPendingSale,
  markSaleLostClaimRace,
  reserveClipCheckoutSession,
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

export async function createCheckoutSession(input: {
  clipId: number
  tierOverride?: string
}) {
  const clip = await getClipById(input.clipId)
  if (!clip) throw new Error('Clip not found')
  if (clip.status === 'claimed') throw new ClipAlreadyClaimedError(clip.id, clip.stripe_checkout_session_id)

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
    // Re-check under row lock after the Stripe round-trip so a claim that landed
    // while Checkout was creating cannot be overwritten by this session id.
    await reserveClipCheckoutSession(clip.id, session.id)
  } catch (err) {
    if (err instanceof ClipAlreadyClaimedError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
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

async function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === 'string') return session.payment_intent
  return session.payment_intent?.id ?? null
}

/**
 * Losing buyer paid but another session claimed the clip first.
 * Mark the pending sale failed/refunded and refund the PaymentIntent when possible.
 */
export async function resolveLostClaimRace(
  err: ClipAlreadyClaimedError,
  session: Stripe.Checkout.Session,
): Promise<{ refunded: boolean }> {
  const pi = await paymentIntentId(session)
  let refunded = false
  if (pi) {
    try {
      await getStripe().refunds.create({
        payment_intent: pi,
        reason: 'duplicate',
      })
      refunded = true
    } catch (refundErr) {
      console.warn('[stripe] lost-claim refund failed; sale marked failed for ops', {
        clipId: err.clipId,
        sessionId: session.id,
        paymentIntentId: pi,
        error: refundErr instanceof Error ? refundErr.message : String(refundErr),
      })
    }
  }

  await markSaleLostClaimRace({
    stripeCheckoutSessionId: session.id,
    winningSessionId: err.existingSessionId,
    stripePaymentIntentId: pi,
    refunded,
  })

  return { refunded }
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
    // Lost claim race: payment already fulfilled for another session — ack so Stripe stops retrying.
    if (err instanceof ClipAlreadyClaimedError) {
      const session =
        event.type === 'checkout.session.completed'
          ? (event.data.object as Stripe.Checkout.Session)
          : null
      let refunded = false
      if (session) {
        const resolved = await resolveLostClaimRace(err, session).catch((resolveErr) => {
          console.error('[stripe] lost-claim resolution failed', resolveErr)
          return { refunded: false }
        })
        refunded = resolved.refunded
      }
      console.warn('[stripe] clip already claimed; acknowledging webhook', {
        clipId: err.clipId,
        existingSessionId: err.existingSessionId,
        refunded,
      })
      res.json({ received: true, skipped: 'clip_already_claimed', refunded })
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
      const { refunded } = await resolveLostClaimRace(err, session)
      return {
        ok: false as const,
        status: 'clip_already_claimed' as const,
        clipId: err.clipId,
        existingSessionId: err.existingSessionId,
        refunded,
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
