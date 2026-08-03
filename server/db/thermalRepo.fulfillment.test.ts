import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canClaimClip,
  ClipAlreadyClaimedError,
  localCleanDownloadUrl,
  nextBountyStatusOnQueueRetry,
  resolveFulfillmentCaptions,
} from './thermalRepo.ts'
import { isAlreadyRefundedError } from '../stripeCheckout.ts'

describe('resolveFulfillmentCaptions', () => {
  it('prefers clip caption columns when present', () => {
    const captions = resolveFulfillmentCaptions(
      {
        ai_caption: ' clip x ',
        ai_tiktok_caption: 'clip tiktok',
        ai_discord_message: ' discord drop ',
      },
      { x: 'bounty x', tiktok: 'bounty tiktok' },
    )
    assert.deepEqual(captions, {
      social: 'clip x',
      x: 'clip x',
      tiktok: 'clip tiktok',
      discord: 'discord drop',
    })
  })

  it('falls back to bounty notes when clip columns are empty', () => {
    const captions = resolveFulfillmentCaptions(
      {
        ai_caption: '   ',
        ai_tiktok_caption: null,
        ai_discord_message: null,
      },
      { x: 'bounty x', tiktok: 'bounty tiktok' },
    )
    assert.deepEqual(captions, {
      social: 'bounty x',
      x: 'bounty x',
      tiktok: 'bounty tiktok',
      discord: null,
    })
  })

  it('returns nulls when both clip columns and bounty notes are blank', () => {
    const captions = resolveFulfillmentCaptions(
      { ai_caption: '', ai_tiktok_caption: '  ', ai_discord_message: null },
      { x: '   ', tiktok: null },
    )
    assert.deepEqual(captions, {
      social: null,
      x: null,
      tiktok: null,
      discord: null,
    })
  })
})

describe('nextBountyStatusOnQueueRetry', () => {
  it('preserves posted and requeues other statuses', () => {
    assert.equal(nextBountyStatusOnQueueRetry('posted'), 'posted')
    assert.equal(nextBountyStatusOnQueueRetry('queued'), 'queued')
    assert.equal(nextBountyStatusOnQueueRetry('failed'), 'queued')
  })
})

describe('localCleanDownloadUrl', () => {
  it('uses spike id when present (heat render folder)', () => {
    assert.equal(
      localCleanDownloadUrl({ id: 99, spike_id: 12 }),
      '/thermal-media/clips/12/heat_clip.mp4',
    )
  })

  it('rewrites watermarked media_url to clean sibling under spike folder', () => {
    assert.equal(
      localCleanDownloadUrl({
        id: 99,
        spike_id: null,
        media_url: '/thermal-media/clips/7/heat_clip_wm.mp4',
      }),
      '/thermal-media/clips/7/heat_clip.mp4',
    )
  })

  it('maps absolute local thermal_media paths from s3_clean_url', () => {
    assert.equal(
      localCleanDownloadUrl({
        spike_id: null,
        s3_clean_url: '/workspace/thermal_media/clips/3/heat_clip.mp4',
      }),
      '/thermal-media/clips/3/heat_clip.mp4',
    )
  })

  it('returns null when no local path can be derived', () => {
    assert.equal(
      localCleanDownloadUrl({
        id: 99,
        spike_id: null,
        media_url: null,
        s3_clean_url: 's3://bucket/clips/1/clean.mp4',
      }),
      null,
    )
  })
})

describe('listBountyClips SQL shape', () => {
  it('avoids DISTINCT + ORDER BY non-selected bounty columns', async () => {
    // Read the query source so regressions cannot reintroduce invalid Postgres SQL.
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, 'thermalRepo.ts'), 'utf8')
    const start = src.indexOf('export async function listBountyClips')
    const next = src.indexOf('\nexport async function', start + 1)
    const body = src.slice(start, next > start ? next : start + 800)
    assert.match(body, /EXISTS\s*\(/)
    assert.doesNotMatch(body, /SELECT\s+DISTINCT\s+c\.\*/)
  })
})

describe('canClaimClip', () => {
  it('allows unclaimed clips', () => {
    assert.equal(canClaimClip({ status: 'unclaimed' }, 'cs_1'), true)
  })

  it('allows Stripe webhook retry for the same session', () => {
    assert.equal(
      canClaimClip(
        { status: 'claimed', stripe_checkout_session_id: 'cs_1' },
        'cs_1',
      ),
      true,
    )
  })

  it('rejects a second buyer session', () => {
    assert.equal(
      canClaimClip(
        { status: 'claimed', stripe_checkout_session_id: 'cs_1' },
        'cs_2',
      ),
      false,
    )
  })

  it('ClipAlreadyClaimedError carries clip and session ids', () => {
    const err = new ClipAlreadyClaimedError(42, 'cs_winner')
    assert.equal(err.name, 'ClipAlreadyClaimedError')
    assert.equal(err.clipId, 42)
    assert.equal(err.existingSessionId, 'cs_winner')
    assert.match(err.message, /42/)
  })
})

describe('attachClipCheckoutSession SQL shape', () => {
  it('locks the clip row before attaching a session', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, 'thermalRepo.ts'), 'utf8')
    const start = src.indexOf('export async function attachClipCheckoutSession')
    const next = src.indexOf('\nexport async function', start + 1)
    const body = src.slice(start, next > start ? next : start + 900)
    assert.match(body, /FOR UPDATE/)
    assert.match(body, /ClipAlreadyClaimedError/)
  })
})

describe('isAlreadyRefundedError', () => {
  it('detects Stripe charge_already_refunded code', () => {
    assert.equal(isAlreadyRefundedError({ code: 'charge_already_refunded' }), true)
  })

  it('detects already-refunded message text', () => {
    assert.equal(
      isAlreadyRefundedError(new Error('Charge ch_1 has already been refunded.')),
      true,
    )
  })

  it('ignores unrelated errors', () => {
    assert.equal(isAlreadyRefundedError(new Error('card_declined')), false)
  })
})
