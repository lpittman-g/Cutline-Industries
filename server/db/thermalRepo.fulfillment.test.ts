import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
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
    assert.equal(nextBountyStatusOnQueueRetry(null), 'queued')
    assert.equal(nextBountyStatusOnQueueRetry(undefined), 'queued')
  })
})
