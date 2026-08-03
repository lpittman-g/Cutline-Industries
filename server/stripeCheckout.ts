import type { Express, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import {
  claimClip,
  getClipById,
  insertPendingSale,
  setClipCheckoutSession,
} from './db/thermalRepo.ts'
import type { SaleTier } from './db/thermalTypes.ts'
import { ROOT } from './youtubeAuth.ts'

const TIER_AMOUNTS: Record<SaleTier, number> = {
  gateway: 1500,
  bounty: 5000,
  retainer: 75000,
}

function publicBaseUrl() {
  return (
    process.env.THERMAL_PUBLIC_URL ||
    process.env.CUTLINE_PUBLIC_URL ||
    'http://127.0.0.1:5173'
  ).replace(/\/$/, '')
}

function apiBaseUrl() {
  const port = process.env.CUTLINE_API_PORT || '8787'
  return (process.env.THERMAL_API_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '')
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
  if (override === 'gateway' || override === 'bounty' || override === 'retainer') return override
  if (clipTier === 'bounty') return 'bounty'
  return 'gateway'
}

function amountForTier(tier: SaleTier) {
  if (tier === 'gateway' && process.env.STRIPE_GATEWAY_AMOUNT_CENTS) {
    return Number(process.env.STRIPE_GATEWAY_AMOUNT_CENTS)
  }
  if (tier === 'bounty' && process.env.STRIPE_BOUNTY_AMOUNT_CENTS) {
    return Number(process.env.STRIPE_BOUNTY_AMOUNT_CENTS)
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
  if (clip.status === 'claimed') throw new Error('Clip already claimed')

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
    success_url: `${base}/checkout/${clip.id}?session_id={CHECKOUT_SESSION_ID}&paid=1`,
    cancel_url: `${base}/checkout/${clip.id}?canceled=1`,
    client_reference_id: String(clip.id),
    metadata: {
      clip_id: String(clip.id),
      tier,
      streamer: clip.streamer_username ?? '',
      game: clip.game ?? '',
    },
  })

  if (!session.url) throw new Error('Stripe did not return checkout URL')

  await setClipCheckoutSession(clip.id, session.id)
  await insertPendingSale({
    clip_id: clip.id,
    tier,
    amount_cents: amountCents,
    stripe_checkout_session_id: session.id,
    metadata: { title, streamer: clip.streamer_username, game: clip.game },
  })

  return { url: session.url, sessionId: session.id, tier, amountCents }
}

async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
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
      if (session.payment_status === 'paid') {
        await fulfillCheckoutSession(session)
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
  if (session.payment_status !== 'paid') {
    return { ok: false as const, status: session.payment_status }
  }
  await fulfillCheckoutSession(session)
  return { ok: true as const, clipId: Number(session.metadata?.clip_id ?? session.client_reference_id) }
}

export function stripeModeLabel() {
  if (!stripeConfigured()) return 'mock'
  if (process.env.STRIPE_WEBHOOK_SECRET?.trim()) return 'live'
  return 'checkout-only'
}

export { ROOT, TIER_AMOUNTS, amountForTier, tierForClip }
