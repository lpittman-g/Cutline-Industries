import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { createPgConfig } from './pgConfig.ts'

const ORIGINAL = {
  DATABASE_SSL: process.env.DATABASE_SSL,
  PGSSLMODE: process.env.PGSSLMODE,
  DATABASE_SSL_REJECT_UNAUTHORIZED: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
}

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('createPgConfig', () => {
  it('skips SSL for local DATABASE_URL', () => {
    delete process.env.DATABASE_SSL
    delete process.env.PGSSLMODE
    const cfg = createPgConfig('postgres://postgres:postgres@127.0.0.1:5432/thermal')
    assert.equal(cfg.ssl, undefined)
  })

  it('enables SSL for Neon-style hosts', () => {
    delete process.env.DATABASE_SSL
    delete process.env.PGSSLMODE
    delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED
    const cfg = createPgConfig(
      'postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require',
    )
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: false })
  })

  it('enables SSL for RDS hosts without query params', () => {
    delete process.env.DATABASE_SSL
    delete process.env.PGSSLMODE
    const cfg = createPgConfig(
      'postgres://thermal:secret@thermal.abc123.us-east-1.rds.amazonaws.com:5432/thermal',
    )
    assert.ok(cfg.ssl)
  })

  it('respects DATABASE_SSL=0 on remote hosts', () => {
    process.env.DATABASE_SSL = '0'
    const cfg = createPgConfig('postgres://u:p@db.example.com:5432/thermal')
    assert.equal(cfg.ssl, undefined)
  })

  it('enables rejectUnauthorized when requested', () => {
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = '1'
    const cfg = createPgConfig('postgres://u:p@db.supabase.co:5432/postgres')
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: true })
  })
})
