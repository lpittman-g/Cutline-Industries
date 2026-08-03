import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMissionControlStatus,
  type MissionReadinessSnapshot,
} from './missionControlStatus.ts'

const emptySnapshot: MissionReadinessSnapshot = {
  database: false,
  authBootstrap: false,
  authLocalBypass: false,
  s3: false,
  stripe: false,
  stripeWebhook: false,
  stripeGatewayPrice: false,
  stripeBountyPrice: false,
  stripeRetainerPrice: false,
  openAi: false,
  discord: false,
  googleProject: false,
  googleSender: false,
  googleClient: false,
  googleToken: false,
}

describe('buildMissionControlStatus', () => {
  it('reports every implementation phase without exposing configuration values', () => {
    const status = buildMissionControlStatus(emptySnapshot)

    assert.deepEqual(
      status.phases.map((phase) => phase.id),
      [
        'thermal-core',
        'auth-roles',
        's3-delivery',
        'stripe-tiers',
        'ai-autopilot',
        'discord',
        'google-workspace',
      ],
    )
    assert.equal(status.summary.implemented, 7)
    assert.equal(status.summary.ready, 0)
    assert.equal(status.nextActions.length, 4)

    const serialized = JSON.stringify(status)
    assert.equal(serialized.includes('DATABASE_URL'), false)
    assert.equal(serialized.includes('STRIPE_SECRET_KEY'), false)
    assert.equal(serialized.includes('WEBHOOK_URL'), false)
    assert.equal(serialized.includes('postgres://'), false)
  })

  it('counts required readiness and keeps optional enhancements non-blocking', () => {
    const status = buildMissionControlStatus({
      ...emptySnapshot,
      database: true,
      authBootstrap: true,
      s3: true,
      stripe: true,
      stripeWebhook: true,
      discord: true,
      googleProject: true,
      googleSender: true,
      googleClient: true,
      googleToken: true,
    })

    assert.equal(status.summary.ready, 7)
    assert.equal(status.nextActions.length, 0)
    assert.equal(
      status.phases.find((phase) => phase.id === 'ai-autopilot')?.status,
      'ready',
    )
    assert.equal(
      status.phases
        .find((phase) => phase.id === 'stripe-tiers')
        ?.checks.find((check) => check.label === 'Gateway Price ID')?.required,
      false,
    )
  })
})
