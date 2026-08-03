import { promises as fs } from 'node:fs'
import { missionControlOpen } from './auth/authMiddleware.ts'
import { thermalDbEnabled } from './db/pool.ts'
import { s3Configured } from './s3Storage.ts'
import { stripeConfigured } from './stripeCheckout.ts'
import { SECRET_PATH, TOKEN_PATH } from './youtubeAuth.ts'

export type ReadinessCheck = {
  label: string
  ready: boolean
  required: boolean
}

export type MissionPhase = {
  id: string
  name: string
  status: 'ready' | 'needs_config'
  implemented: true
  description: string
  checks: ReadinessCheck[]
}

export type MissionReadinessSnapshot = {
  database: boolean
  authBootstrap: boolean
  authLocalBypass: boolean
  s3: boolean
  stripe: boolean
  stripeWebhook: boolean
  stripeGatewayPrice: boolean
  stripeBountyPrice: boolean
  stripeRetainerPrice: boolean
  openAi: boolean
  discord: boolean
  googleProject: boolean
  googleSender: boolean
  googleClient: boolean
  googleToken: boolean
}

const REPOSITORY_URL = 'https://github.com/lpittman-g/Cutline-Industries'

function phase(
  id: string,
  name: string,
  description: string,
  checks: ReadinessCheck[],
): MissionPhase {
  return {
    id,
    name,
    description,
    checks,
    implemented: true,
    status: checks.filter((check) => check.required).every((check) => check.ready)
      ? 'ready'
      : 'needs_config',
  }
}

export function buildMissionControlStatus(snapshot: MissionReadinessSnapshot) {
  const phases = [
    phase(
      'thermal-core',
      'Thermal core',
      'Heat detection, clip rendering, bounty distribution, CRM, and revenue ledger.',
      [{ label: 'Postgres configured', ready: snapshot.database, required: true }],
    ),
    phase(
      'auth-roles',
      'Auth & roles',
      'Verified accounts and operator/admin access protect Mission Control.',
      [
        { label: 'Postgres configured', ready: snapshot.database, required: true },
        {
          label: 'Admin bootstrap configured',
          ready: snapshot.authBootstrap,
          required: !snapshot.authLocalBypass,
        },
        { label: 'Local access bypass active', ready: snapshot.authLocalBypass, required: false },
      ],
    ),
    phase(
      's3-delivery',
      'S3 delivery',
      'Private clean masters, public previews, and expiring paid download links.',
      [{ label: 'Region and bucket configured', ready: snapshot.s3, required: true }],
    ),
    phase(
      'stripe-tiers',
      'Stripe tiers',
      'Gateway, bounty, and retainer Checkout flows with webhook fulfillment.',
      [
        { label: 'Checkout configured', ready: snapshot.stripe, required: true },
        { label: 'Webhook configured', ready: snapshot.stripeWebhook, required: true },
        { label: 'Gateway Price ID', ready: snapshot.stripeGatewayPrice, required: false },
        { label: 'Bounty Price ID', ready: snapshot.stripeBountyPrice, required: false },
        { label: 'Retainer Price ID', ready: snapshot.stripeRetainerPrice, required: false },
      ],
    ),
    phase(
      'ai-autopilot',
      'AI autopilot',
      'Clip copy, bounty queueing, Discord drops, and developer pitch orchestration.',
      [
        { label: 'Postgres configured', ready: snapshot.database, required: true },
        { label: 'OpenAI enhancement configured', ready: snapshot.openAi, required: false },
      ],
    ),
    phase(
      'discord',
      'Discord',
      'Heat alerts and paid clip-drop delivery through the existing webhook integration.',
      [{ label: 'Heat webhook configured', ready: snapshot.discord, required: true }],
    ),
    phase(
      'google-workspace',
      'Google Workspace',
      'YouTube publishing and Gmail developer outreach through shared OAuth.',
      [
        { label: 'Cloud project configured', ready: snapshot.googleProject, required: true },
        { label: 'Workspace sender configured', ready: snapshot.googleSender, required: true },
        { label: 'OAuth client available', ready: snapshot.googleClient, required: true },
        { label: 'OAuth token available', ready: snapshot.googleToken, required: true },
      ],
    ),
  ]

  const nextActions = phases
    .filter((item) => item.status === 'needs_config')
    .slice(0, 4)
    .map((item) => {
      const missing = item.checks.find((check) => check.required && !check.ready)
      return {
        phaseId: item.id,
        label: `Complete ${item.name}`,
        detail: missing ? missing.label : 'Review required configuration',
      }
    })

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      implemented: phases.length,
      ready: phases.filter((item) => item.status === 'ready').length,
      total: phases.length,
    },
    phases,
    nextActions,
    links: [
      {
        id: 'pull-requests',
        label: 'Pull requests',
        href: `${REPOSITORY_URL}/pulls`,
        kind: 'github',
      },
      {
        id: 'ci',
        label: 'SynthLang CI',
        href: `${REPOSITORY_URL}/actions/workflows/synthlang-pipeline.yml`,
        kind: 'github',
      },
      {
        id: 'cursor-automation',
        label: 'Thermal Autopilot automation',
        href: 'https://cursor.com/automations/26c7e362-8eff-11f1-a7d1-d6b4613131ce',
        kind: 'cursor',
      },
      {
        id: 'cursor-automations',
        label: 'Cursor Automations',
        href: 'https://cursor.com/automations',
        kind: 'cursor',
      },
    ],
  }
}

async function fileAvailable(file: string) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export async function getMissionControlStatus() {
  const [googleClient, googleToken] = await Promise.all([
    fileAvailable(SECRET_PATH),
    fileAvailable(TOKEN_PATH),
  ])

  return buildMissionControlStatus({
    database: thermalDbEnabled(),
    authBootstrap: Boolean(process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim()),
    authLocalBypass: missionControlOpen(),
    s3: s3Configured(),
    stripe: stripeConfigured(),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    stripeGatewayPrice: Boolean(process.env.STRIPE_PRICE_GATEWAY?.trim()),
    stripeBountyPrice: Boolean(process.env.STRIPE_PRICE_BOUNTY?.trim()),
    stripeRetainerPrice: Boolean(process.env.STRIPE_PRICE_RETAINER?.trim()),
    openAi: Boolean(process.env.OPENAI_API_KEY?.trim()),
    discord: Boolean(process.env.DISCORD_HEAT_WEBHOOK_URL?.trim()),
    googleProject: Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim()),
    googleSender: Boolean(process.env.GOOGLE_WORKSPACE_SENDER_EMAIL?.trim()),
    googleClient,
    googleToken,
  })
}
