import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CLIP_CHECKOUT_LOCK_CLASS } from './db/thermalRepo.ts'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, 'stripeCheckout.ts'), 'utf8')
const apiSrc = readFileSync(join(here, 'thermalApi.ts'), 'utf8')

describe('stripe lost-claim race handling', () => {
  it('exports a stable advisory-lock class for clip checkout', () => {
    assert.equal(CLIP_CHECKOUT_LOCK_CLASS, 42001)
  })

  it('acks ClipAlreadyClaimedError in the webhook path', () => {
    assert.match(src, /ClipAlreadyClaimedError/)
    assert.match(src, /skipped:\s*'clip_already_claimed'/)
    assert.match(src, /resolveLostClaimRace/)
    assert.match(src, /refunds\.create/)
    assert.match(src, /markSaleLostClaimRace/)
    assert.match(src, /CUTLINE_DRY_RUN/)
    assert.match(src, /isAlreadyRefundedError/)
    assert.match(src, /status: 'failed'/)
  })

  it('marks sale after Stripe refund attempt (not before)', () => {
    const start = src.indexOf('export async function resolveLostClaimRace')
    const next = src.indexOf('\nexport async function', start + 1)
    const body = src.slice(start, next > start ? next : start + 2500)
    const tryIdx = body.indexOf('try {')
    const tryBody = body.slice(tryIdx > 0 ? tryIdx : 0)
    const refundIdx = tryBody.indexOf('refunds.create')
    const markIdx = tryBody.indexOf("status: 'refunded'")
    assert.ok(refundIdx > 0, 'expected refunds.create in resolveLostClaimRace try')
    assert.ok(markIdx > refundIdx, 'ledger refunded mark must follow Stripe refund')
    assert.match(body, /status: 'failed'/)
  })

  it('acks RetainerAlreadyActiveError in the webhook path', () => {
    assert.match(src, /RetainerAlreadyActiveError/)
    assert.match(src, /skipped:\s*'retainer_already_active'/)
    assert.match(src, /resolveLostRetainerRace/)
    assert.match(src, /subscriptions\.cancel/)
  })

  it('confirmCheckoutSession returns clip_already_claimed instead of throwing', () => {
    const start = src.indexOf('export async function confirmCheckoutSession')
    const next = src.indexOf('\nexport async function', start + 1)
    const body = src.slice(start, next > start ? next : start + 1600)
    assert.match(body, /status:\s*'clip_already_claimed'/)
    assert.match(body, /resolveLostClaimRace/)
    assert.match(body, /status:\s*'retainer_already_active'/)
    assert.match(body, /resolveLostRetainerRace/)
  })

  it('createCheckoutSession holds advisory + row lock across Stripe create', () => {
    const start = src.indexOf('export async function createCheckoutSession')
    const next = src.indexOf('\nexport async function', start + 1)
    const body = src.slice(start, next > start ? next : start + 2200)
    assert.match(body, /pg_advisory_xact_lock/)
    assert.match(body, /CLIP_CHECKOUT_LOCK_CLASS/)
    assert.match(body, /FOR UPDATE/)
    assert.match(body, /checkout\.sessions\.expire/)
    assert.match(body, /ClipAlreadyClaimedError/)
  })

  it('checkout API routes map claim/retainer conflicts to HTTP 409', () => {
    assert.match(apiSrc, /status\(409\)/)
    assert.match(apiSrc, /clip_already_claimed/)
    assert.match(apiSrc, /ClipAlreadyClaimedError/)
    assert.match(apiSrc, /retainer_already_active/)
    assert.match(apiSrc, /RetainerAlreadyActiveError/)
  })
})
