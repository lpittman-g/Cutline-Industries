import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { publicBaseUrl } from './auth/authCrypto.ts'
import { buildFallbackCopy, normalizeAutopilotCopy } from './thermalHeatAutopilot.ts'

describe('buildFallbackCopy', () => {
  it('includes streamer, game, and heat in every channel', () => {
    const copy = buildFallbackCopy({
      streamerName: 'nox',
      gameTitle: 'Starforge',
      msgPerMin: 180,
    })
    assert.match(copy.discordHypeMessage, /180/)
    assert.match(copy.discordHypeMessage, /Starforge/)
    assert.match(copy.xCaption, /@nox/)
    assert.match(copy.tiktokCaption, /Starforge/)
    assert.match(copy.devEmailSubject, /Starforge/)
    assert.match(copy.devEmailBody, /@nox/)
    assert.notEqual(copy.xCaption, copy.tiktokCaption)
  })
})

describe('normalizeAutopilotCopy', () => {
  it('fills missing keys from fallback', () => {
    const fallback = buildFallbackCopy({
      streamerName: 'a',
      gameTitle: 'b',
      msgPerMin: 10,
    })
    const copy = normalizeAutopilotCopy(
      { xCaption: 'custom x', tiktokCaption: '   ' },
      fallback,
    )
    assert.equal(copy.xCaption, 'custom x')
    assert.equal(copy.tiktokCaption, fallback.tiktokCaption)
    assert.equal(copy.discordHypeMessage, fallback.discordHypeMessage)
  })

  it('accepts a full OpenAI-shaped payload', () => {
    const fallback = buildFallbackCopy({
      streamerName: 'a',
      gameTitle: 'b',
      msgPerMin: 10,
    })
    const copy = normalizeAutopilotCopy(
      {
        discordHypeMessage: 'd',
        xCaption: 'x',
        tiktokCaption: 't',
        devEmailSubject: 's',
        devEmailBody: 'body',
      },
      fallback,
    )
    assert.deepEqual(copy, {
      discordHypeMessage: 'd',
      xCaption: 'x',
      tiktokCaption: 't',
      devEmailSubject: 's',
      devEmailBody: 'body',
    })
  })
})

const URL_KEYS = ['THERMAL_PUBLIC_URL', 'CUTLINE_PUBLIC_URL'] as const

describe('publicBaseUrl for Thermal links', () => {
  const stash: Partial<Record<(typeof URL_KEYS)[number], string | undefined>> = {}

  function stashUrlEnv() {
    for (const key of URL_KEYS) {
      stash[key] = process.env[key]
      delete process.env[key]
    }
  }

  function restoreUrlEnv() {
    for (const key of URL_KEYS) {
      const value = stash[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }

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
