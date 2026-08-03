/**
 * Create (or reuse) Thermal Stripe Products + Prices and print env lines.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_… npm run stripe:setup-prices
 *   # or with .env loaded:
 *   npm run stripe:setup-prices
 *
 * Run once in Test mode and once in Live mode (switch the key).
 */
import path from 'node:path'
import dotenv from 'dotenv'
import Stripe from 'stripe'
import { ROOT } from '../server/youtubeAuth.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const LOOKUPS = {
  gateway: {
    lookupKey: 'thermal_gateway_15',
    productName: 'Thermal Gateway',
    description: 'Clip claim — gateway tier ($15)',
    unitAmount: 1500,
    recurring: null as Stripe.PriceCreateParams.Recurring | null,
    envVar: 'STRIPE_PRICE_GATEWAY',
  },
  bounty: {
    lookupKey: 'thermal_bounty_50',
    productName: 'Thermal Bounty',
    description: 'Clip claim — bounty tier ($50)',
    unitAmount: 5000,
    recurring: null as Stripe.PriceCreateParams.Recurring | null,
    envVar: 'STRIPE_PRICE_BOUNTY',
  },
  retainer: {
    lookupKey: 'thermal_retainer_750_mo',
    productName: 'Thermal Retainer',
    description: 'Indie-dev retainer subscription ($750/mo)',
    unitAmount: 75000,
    recurring: { interval: 'month' as const },
    envVar: 'STRIPE_PRICE_RETAINER',
  },
} as const

async function findOrCreatePrice(
  stripe: Stripe,
  spec: (typeof LOOKUPS)[keyof typeof LOOKUPS],
): Promise<string> {
  const existing = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    active: true,
    limit: 1,
  })
  if (existing.data[0]) {
    console.log(`Reuse ${spec.envVar}=${existing.data[0].id} (${spec.lookupKey})`)
    return existing.data[0].id
  }

  const product = await stripe.products.create({
    name: spec.productName,
    description: spec.description,
    metadata: { cutline: 'thermal', lookup_key: spec.lookupKey },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: spec.unitAmount,
    lookup_key: spec.lookupKey,
    ...(spec.recurring ? { recurring: spec.recurring } : {}),
    metadata: { cutline: 'thermal' },
  })

  console.log(`Created ${spec.envVar}=${price.id} product=${product.id}`)
  return price.id
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    console.error('STRIPE_SECRET_KEY is required (set in .env or the environment).')
    console.error('Dashboard: https://dashboard.stripe.com/apikeys')
    process.exit(1)
  }

  const mode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown'
  console.log(`Stripe mode: ${mode}`)
  console.log('')

  const stripe = new Stripe(key)
  const gateway = await findOrCreatePrice(stripe, LOOKUPS.gateway)
  const bounty = await findOrCreatePrice(stripe, LOOKUPS.bounty)
  const retainer = await findOrCreatePrice(stripe, LOOKUPS.retainer)

  console.log('')
  console.log('# Paste into .env (or deployment secrets)')
  console.log(`STRIPE_PRICE_GATEWAY=${gateway}`)
  console.log(`STRIPE_PRICE_BOUNTY=${bounty}`)
  console.log(`STRIPE_PRICE_RETAINER=${retainer}`)
  console.log('')
  console.log('Webhook URL:')
  console.log('  https://cutline-industries.studio/api/stripe/webhook')
  console.log('Local:')
  console.log('  stripe listen --forward-to localhost:8787/api/stripe/webhook')
  console.log('Docs: docs/STRIPE.md')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
