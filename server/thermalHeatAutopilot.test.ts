import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { publicBaseUrl } from './auth/authCrypto.ts'
import { asCopy, fallbackCopy } from './thermalHeatAutopilot.ts'

const URL_KEYS = ['THERMAL_PUBLIC_URL', 'CUTLINE_PUBLIC_URL'] as const
const saved: Partial<Record<(typeof URL_KEYS)[number], string | undefined>> = {}

function stashUrlEnv() {
  for (const key of URL_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
}

function restoreUrlEnv() {
  for (const key of URL_KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('thermalHeatAutopilot copy helpers', () => {
  it('builds deterministic fallback copy', () => {
    const copy = fallbackCopy({
      streamerName: 'nova_fps',
      gameTitle: 'Hollow Paths',
      msgPerMin: 186,
    })
    assert.match(copy.discordHypeMessage, /186/)
    assert.match(copy.xCaption, /@nova_fps/)
    assert.match(copy.tiktokCaption, /Hollow Paths/)
    assert.match(copy.devEmailSubject, /Hollow Paths/)
    assert.ok(copy.devEmailBody.includes('Steam wishlist'))
  })

  it('fills missing OpenAI JSON fields from fallback', () => {
    const fallback = fallbackCopy({
      streamerName: 'pixelrift',
      gameTitle: 'Neon Circuit',
      msgPerMin: 140,
    })
    const copy = asCopy(
      {
        discordHypeMessage: '  Custom hype  ',
        xCaption: '',
        tiktokCaption: 'TikTok only',
      },
      fallback,
    )
    assert.equal(copy.discordHypeMessage, 'Custom hype')
    assert.equal(copy.xCaption, fallback.xCaption)
    assert.equal(copy.tiktokCaption, 'TikTok only')
    assert.equal(copy.devEmailSubject, fallback.devEmailSubject)
  })
})

describe('publicBaseUrl for Thermal links', () => {
  afterEach(restoreUrlEnv)

  it('prefers THERMAL_PUBLIC_URL over CUTLINE_PUBLIC_URL', () => {
    stashUrlEnv()
    process.env.THERMAL_PUBLIC_URL = 'http://127.0.0.1:5173/'
    process.env.CUTLINE_PUBLIC_URL = 'https://cutline-industries.studio'
    assert.equal(publicBaseUrl(), 'http://127.0.0.1:5173')
  })

  it('falls back to CUTLINE_PUBLIC_URL then local default', () => {
    stashUrlEnv()
    process.env.CUTLINE_PUBLIC_URL = 'https://cutline-industries.studio/'
    assert.equal(publicBaseUrl(), 'https://cutline-industries.studio')
    delete process.env.CUTLINE_PUBLIC_URL
    assert.equal(publicBaseUrl(), 'http://127.0.0.1:5173')
  })
})
