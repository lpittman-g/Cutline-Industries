import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { localCleanDownloadUrl } from './thermalApi.ts'

describe('localCleanDownloadUrl', () => {
  it('rewrites watermarked preview URL to clean sibling under spike id', () => {
    assert.equal(
      localCleanDownloadUrl({
        spike_id: 7,
        media_url: '/thermal-media/clips/7/heat_clip_wm.mp4',
      }),
      '/thermal-media/clips/7/heat_clip.mp4',
    )
  })

  it('uses spike_id when media_url is absent', () => {
    assert.equal(
      localCleanDownloadUrl({ spike_id: 42, media_url: null }),
      '/thermal-media/clips/42/heat_clip.mp4',
    )
  })

  it('does not use clip id as the media folder', () => {
    const url = localCleanDownloadUrl({
      spike_id: 9,
      media_url: '/thermal-media/clips/9/heat_clip_wm.mp4',
    })
    assert.ok(url)
    assert.match(url, /\/clips\/9\//)
    assert.doesNotMatch(url, /\/clips\/1\//)
  })

  it('maps absolute local thermal_media paths', () => {
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
        spike_id: null,
        media_url: null,
        s3_clean_url: 's3://bucket/clips/1/clean.mp4',
      }),
      null,
    )
  })
})
