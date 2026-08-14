import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { sentryEnabled, sentryEnvironment, sentryInitOptions, sentryTracesSampleRate } from './instrument.ts'

const KEYS = ['SENTRY_DSN', 'SENTRY_ENVIRONMENT', 'SENTRY_TRACES_SAMPLE_RATE', 'NODE_ENV'] as const
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

describe('Sentry instrument', () => {
  afterEach(restoreEnv)

  it('stays disabled without SENTRY_DSN so local/cloud dry-run does not send events', () => {
    stashEnv()
    assert.equal(sentryEnabled(), false)
    assert.equal(sentryInitOptions(), null)
  })

  it('builds init options from DSN and tracing env', () => {
    stashEnv()
    process.env.SENTRY_DSN = ' https://key@o1.ingest.sentry.io/1 '
    process.env.SENTRY_ENVIRONMENT = 'staging'
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.25'
    assert.equal(sentryEnabled(), true)
    assert.deepEqual(sentryInitOptions(), {
      dsn: 'https://key@o1.ingest.sentry.io/1',
      environment: 'staging',
      tracesSampleRate: 0.25,
      sendDefaultPii: false,
    })
  })

  it('falls back to NODE_ENV and a full traces sample rate', () => {
    stashEnv()
    process.env.SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1'
    process.env.NODE_ENV = 'production'
    assert.equal(sentryEnvironment(), 'production')
    assert.equal(sentryTracesSampleRate(), 1)
  })
})
