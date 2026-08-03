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
