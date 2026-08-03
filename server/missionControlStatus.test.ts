import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMissionControlStatus,
  type MissionReadinessSnapshot,
  type MissionRuntimeSnapshot,
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

const runtimeSnapshot: MissionRuntimeSnapshot = {
  vod: {
    running: true,
    hasRun: true,
    hasError: false,
    lastRunAt: '2026-08-03T07:00:00.000Z',
    artifactCount: 3,
  },
  ai: {
    running: false,
    hasRun: true,
    hasError: true,
    lastRunAt: '2026-08-03T06:00:00.000Z',
    artifactCount: 2,
  },
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

  it('groups automations by runtime status with safe artifact and launch metadata', () => {
    const status = buildMissionControlStatus(
      {
        ...emptySnapshot,
        database: true,
        googleClient: true,
        googleToken: true,
      },
      runtimeSnapshot,
    )

    assert.equal(status.repositories[0]?.name, 'Cutline-Industries')
    assert.equal(status.repositories[0]?.automationCount, 4)
    assert.equal(status.automationSummary.running, 1)
    assert.equal(status.automationSummary.attention, 1)
    assert.equal(status.automationSummary.ready, 1)
    assert.equal(status.automationSummary.external, 1)
    assert.deepEqual(
      status.automationGroups
        .find((group) => group.id === 'running')
        ?.agents.map((agent) => agent.id),
      ['vod-autopilot'],
    )

    const vod = status.automationGroups
      .flatMap((group) => group.agents)
      .find((agent) => agent.id === 'vod-autopilot')
    assert.equal(vod?.run.progress, null)
    assert.equal(vod?.run.progressState, 'indeterminate')
    assert.equal(vod?.artifacts[0]?.count, 3)
    assert.equal(vod?.launch.href, '/os/autopilot')
  })
})
