import { promises as fs } from 'node:fs'
import { missionControlOpen } from './auth/authMiddleware.ts'
import { thermalDbEnabled } from './db/pool.ts'
import { s3Configured } from './s3Storage.ts'
import { stripeConfigured } from './stripeCheckout.ts'
import { ROOT, SECRET_PATH, TOKEN_PATH } from './youtubeAuth.ts'

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

export type MissionRuntimeSnapshot = {
  vod: {
    running: boolean
    hasRun: boolean
    hasError: boolean
    lastRunAt: string | null
    artifactCount: number
  }
  ai: {
    running: boolean
    hasRun: boolean
    hasError: boolean
    lastRunAt: string | null
    artifactCount: number
  }
}

type AutomationStatus = 'running' | 'ready' | 'attention' | 'external'

const REPOSITORY_URL = 'https://github.com/lpittman-g/Cutline-Industries'
const AUTOMATION_URL =
  'https://cursor.com/automations/26c7e362-8eff-11f1-a7d1-d6b4613131ce'

const EMPTY_RUNTIME: MissionRuntimeSnapshot = {
  vod: {
    running: false,
    hasRun: false,
    hasError: false,
    lastRunAt: null,
    artifactCount: 0,
  },
  ai: {
    running: false,
    hasRun: false,
    hasError: false,
    lastRunAt: null,
    artifactCount: 0,
  },
}

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

function pipelineStatus(
  runtime: MissionRuntimeSnapshot['vod'],
  configured: boolean,
): AutomationStatus {
  if (runtime.running) return 'running'
  if (runtime.hasError || !configured) return 'attention'
  return 'ready'
}

function runProgress(runtime: MissionRuntimeSnapshot['vod'], configured: boolean) {
  if (runtime.running) {
    return {
      progress: null,
      progressState: 'indeterminate' as const,
      currentStep: 'Processing a queued run',
    }
  }
  if (runtime.hasError) {
    return {
      progress: 100,
      progressState: 'determinate' as const,
      currentStep: 'Last run needs review',
    }
  }
  if (!configured) {
    return {
      progress: 0,
      progressState: 'determinate' as const,
      currentStep: 'Waiting for required configuration',
    }
  }
  if (runtime.hasRun) {
    return {
      progress: 100,
      progressState: 'determinate' as const,
      currentStep: 'Last run completed',
    }
  }
  return {
    progress: 0,
    progressState: 'determinate' as const,
    currentStep: 'Ready for first run',
  }
}

export function buildMissionControlStatus(
  snapshot: MissionReadinessSnapshot,
  runtime: MissionRuntimeSnapshot = EMPTY_RUNTIME,
) {
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

  const googleReady = snapshot.googleClient && snapshot.googleToken
  const agents = [
    {
      id: 'thermal-heat',
      name: 'Thermal heat autopilot',
      repositoryId: 'cutline-industries',
      status: (snapshot.database ? 'ready' : 'attention') as AutomationStatus,
      summary: 'Event-driven heat detection, clip render, delivery, and monetization.',
      run: {
        mode: 'Event-driven',
        progress: snapshot.database ? 100 : 0,
        progressState: 'determinate' as const,
        currentStep: snapshot.database
          ? 'Watching for heat events'
          : 'Waiting for Thermal database',
        lastRunAt: null,
        hasError: false,
      },
      artifacts: [
        { label: 'Clip vault', href: '/app/clips', count: null },
        { label: 'Bounty queue', href: '/app/bounty', count: null },
        { label: 'Revenue ledger', href: '/app/revenue', count: null },
      ],
      launch: { label: 'Open live streams', href: '/app/streams', external: false },
    },
    {
      id: 'vod-autopilot',
      name: 'VOD Autopilot',
      repositoryId: 'cutline-industries',
      status: pipelineStatus(runtime.vod, googleReady),
      summary: 'Turns inbox VODs into vertical Shorts through the existing processing OS.',
      run: {
        mode: 'Worker',
        ...runProgress(runtime.vod, googleReady),
        lastRunAt: runtime.vod.lastRunAt,
        hasError: runtime.vod.hasError,
      },
      artifacts: [
        {
          label: 'Processed exports',
          href: '/os/autopilot',
          count: runtime.vod.artifactCount,
        },
      ],
      launch: { label: 'Open VOD Autopilot', href: '/os/autopilot', external: false },
    },
    {
      id: 'ai-shorts',
      name: 'AI Shorts pipeline',
      repositoryId: 'cutline-industries',
      status: pipelineStatus(runtime.ai, googleReady),
      summary: 'Builds Thermal Shorts from project topics and audience feedback.',
      run: {
        mode: 'Worker',
        ...runProgress(runtime.ai, googleReady),
        lastRunAt: runtime.ai.lastRunAt,
        hasError: runtime.ai.hasError,
      },
      artifacts: [
        {
          label: 'Processed topics',
          href: '/feedback',
          count: runtime.ai.artifactCount,
        },
      ],
      launch: { label: 'Open audience feedback', href: '/feedback', external: false },
    },
    {
      id: 'cursor-thermal',
      name: 'Cursor Thermal Automation',
      repositoryId: 'cutline-industries',
      status: 'external' as AutomationStatus,
      summary: 'PR-triggered maintenance agent managed in the Cursor dashboard.',
      run: {
        mode: 'PR label',
        progress: null,
        progressState: 'external' as const,
        currentStep: 'Managed by Cursor Automations',
        lastRunAt: null,
        hasError: false,
      },
      artifacts: [
        { label: 'Pull requests', href: `${REPOSITORY_URL}/pulls`, count: null },
        {
          label: 'CI runs',
          href: `${REPOSITORY_URL}/actions/workflows/synthlang-pipeline.yml`,
          count: null,
        },
      ],
      launch: { label: 'Open Cursor Automation', href: AUTOMATION_URL, external: true },
    },
  ]
  const statusGroups = [
    { id: 'running', label: 'Running now' },
    { id: 'attention', label: 'Needs attention' },
    { id: 'ready', label: 'Ready / waiting' },
    { id: 'external', label: 'Externally managed' },
  ].map((group) => ({
    ...group,
    agents: agents.filter((agent) => agent.status === group.id),
  }))

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      implemented: phases.length,
      ready: phases.filter((item) => item.status === 'ready').length,
      total: phases.length,
    },
    phases,
    nextActions,
    repositories: [
      {
        id: 'cutline-industries',
        owner: 'lpittman-g',
        name: 'Cutline-Industries',
        defaultBranch: 'main',
        href: REPOSITORY_URL,
        automationCount: agents.length,
      },
    ],
    automationSummary: {
      running: agents.filter((agent) => agent.status === 'running').length,
      attention: agents.filter((agent) => agent.status === 'attention').length,
      ready: agents.filter((agent) => agent.status === 'ready').length,
      external: agents.filter((agent) => agent.status === 'external').length,
    },
    automationGroups: statusGroups,
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
        href: AUTOMATION_URL,
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

type PipelineState = {
  processed?: Record<string, unknown>
  processedTopics?: Record<string, unknown>
  lastRun?: unknown
  lastError?: unknown
  running?: unknown
}

async function readPipelineState(file: string): Promise<PipelineState> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as PipelineState
  } catch {
    return {}
  }
}

function safeTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function runtimeState(state: PipelineState, artifacts: Record<string, unknown> | undefined) {
  return {
    running: state.running === true,
    hasRun: safeTimestamp(state.lastRun) !== null,
    hasError: Boolean(state.lastError),
    lastRunAt: safeTimestamp(state.lastRun),
    artifactCount: Object.keys(artifacts ?? {}).length,
  }
}

export async function getMissionControlStatus() {
  const [googleClient, googleToken, vodState, aiState] = await Promise.all([
    fileAvailable(SECRET_PATH),
    fileAvailable(TOKEN_PATH),
    readPipelineState(`${ROOT}/autopilot-state.json`),
    readPipelineState(`${ROOT}/ai-pipeline-state.json`),
  ])

  return buildMissionControlStatus(
    {
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
    },
    {
      vod: runtimeState(vodState, vodState.processed),
      ai: runtimeState(aiState, aiState.processedTopics),
    },
  )
}
