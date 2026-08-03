import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { s3Configured } from './s3Storage.ts'

const KEYS = [
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
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

describe('s3Configured', () => {
  afterEach(restoreEnv)

  it('is false when bucket or region is missing', () => {
    stashEnv()
    assert.equal(s3Configured(), false)
    process.env.AWS_REGION = 'us-east-1'
    assert.equal(s3Configured(), false)
    delete process.env.AWS_REGION
    process.env.AWS_S3_BUCKET_NAME = 'thermal-video-clips'
    assert.equal(s3Configured(), false)
  })

  it('is true with region + bucket and no access keys (IAM role path)', () => {
    stashEnv()
    process.env.AWS_REGION = 'us-east-1'
    process.env.AWS_S3_BUCKET_NAME = 'thermal-video-clips'
    assert.equal(s3Configured(), true)
  })
})
