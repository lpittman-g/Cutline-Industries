import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  squarespaceConfigured,
  squarespaceSiteUrl,
  squarespaceStatusPayload,
} from './squarespaceClient.ts'

const KEYS = ['SQUARESPACE_API_KEY', 'SQUARESPACE_SITE_URL', 'CUTLINE_PUBLIC_URL'] as const
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

function stashEnv() {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
}

function restoreEnv() {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('squarespaceClient config', () => {
  afterEach(restoreEnv)

  it('reports configured only with API key', () => {
    stashEnv()
    assert.equal(squarespaceConfigured(), false)
    process.env.SQUARESPACE_API_KEY = '39c7064e-test-key'
    assert.equal(squarespaceConfigured(), true)
  })

  it('resolves site URL from env fallbacks', () => {
    stashEnv()
    assert.equal(squarespaceSiteUrl(), 'https://www.cutline-industries.studio')
    process.env.CUTLINE_PUBLIC_URL = 'https://cutline-industries.studio'
    assert.equal(squarespaceSiteUrl(), 'https://cutline-industries.studio')
    process.env.SQUARESPACE_SITE_URL = 'https://www.cutline-industries.studio'
    assert.equal(squarespaceSiteUrl(), 'https://www.cutline-industries.studio')
  })

  it('includes hosting note in status payload', () => {
    stashEnv()
    process.env.SQUARESPACE_API_KEY = 'x'
    const payload = squarespaceStatusPayload()
    assert.equal(payload.configured, true)
    assert.match(payload.hostingNote, /DNS cutover/i)
  })
})
