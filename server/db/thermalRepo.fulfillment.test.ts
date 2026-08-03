import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
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
