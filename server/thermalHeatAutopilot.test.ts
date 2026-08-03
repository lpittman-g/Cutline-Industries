import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
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
