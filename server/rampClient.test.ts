import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  rampApiBase,
  rampAuthorizeBase,
  rampConfigured,
  rampEnv,
  rampRedirectUri,
  rampScopes,
} from './rampClient.ts'

const KEYS = [
  'RAMP_ENV',
  'RAMP_CLIENT_ID',
  'RAMP_CLIENT_SECRET',
  'RAMP_REDIRECT_URI',
  'RAMP_SCOPES',
  'CUTLINE_PUBLIC_URL',
] as const

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

describe('rampClient config', () => {
  afterEach(restoreEnv)

  it('defaults to demo hosts', () => {
    stashEnv()
    assert.equal(rampEnv(), 'demo')
    assert.equal(rampApiBase(), 'https://demo-api.ramp.com/developer/v1')
    assert.equal(rampAuthorizeBase(), 'https://demo.ramp.com')
    assert.equal(rampScopes(), 'transactions:read')
  })

  it('switches to production hosts', () => {
    stashEnv()
    process.env.RAMP_ENV = 'production'
    assert.equal(rampEnv(), 'production')
    assert.equal(rampApiBase(), 'https://api.ramp.com/developer/v1')
    assert.equal(rampAuthorizeBase(), 'https://app.ramp.com')
  })

  it('reports configured only with id + secret', () => {
    stashEnv()
    assert.equal(rampConfigured(), false)
    process.env.RAMP_CLIENT_ID = 'ramp_id_x'
    assert.equal(rampConfigured(), false)
    process.env.RAMP_CLIENT_SECRET = 'ramp_sec_x'
    assert.equal(rampConfigured(), true)
  })

  it('builds redirect from RAMP_REDIRECT_URI or public URL', () => {
    stashEnv()
    process.env.CUTLINE_PUBLIC_URL = 'https://cutline-industries.studio'
    assert.equal(rampRedirectUri(), 'https://cutline-industries.studio/callback')
    process.env.RAMP_REDIRECT_URI = 'https://cutline-industries.studio/callback'
    assert.equal(rampRedirectUri(), 'https://cutline-industries.studio/callback')
  })
})
