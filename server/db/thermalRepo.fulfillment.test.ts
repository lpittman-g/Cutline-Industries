import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canClaimClip,
  localCleanDownloadUrl,
  nextBountyStatusOnQueueRetry,
  resolveFulfillmentCaptions,
} from './thermalRepo.ts'

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

  it('derives folder from watermarked media_url when spike_id is missing', () => {
    assert.equal(
      localCleanDownloadUrl({
        id: 99,
        spike_id: null,
        media_url: '/thermal-media/clips/7/heat_clip_wm.mp4',
      }),
      '/thermal-media/clips/7/heat_clip.mp4',
    )
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
})
