import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import dotenv from 'dotenv'
import { probeDuration } from './ffmpegCut.ts'
import { renderAiShort } from './renderAiShort.ts'
import type { PlannedClip } from './planClips.ts'
import { PROJECT, PROJECT_TOPICS, type ProjectTopic } from './projectContent.ts'
import { runFeedbackLoop } from './youtubeFeedback.ts'
import { moveToUploaded, uploadShort } from './youtubeUpload.ts'
import { ROOT, TOKEN_PATH } from './youtubeAuth.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const execFileAsync = promisify(execFile)

const INBOX = path.join(ROOT, 'inbox')
const AI_OUT = path.join(ROOT, 'ai_out')
const UPLOADED = path.join(ROOT, 'uploaded', 'ai')
const STATE_PATH = path.join(ROOT, 'ai-pipeline-state.json')
const LOG_PATH = path.join(ROOT, 'ai-pipeline.log')
const TREND_QUEUE = path.join(INBOX, 'trend_queue.json')
const SCRIPT_PACKAGE = path.join(INBOX, 'script_package.json')
const PROJECT_QUEUE = path.join(INBOX, 'project_topic_queue.json')

const MODE = process.env.CUTLINE_AI_MODE || 'project'
const PRIVACY = (process.env.CUTLINE_AI_PRIVACY || process.env.CUTLINE_PRIVACY || 'public') as
  | 'private'
  | 'unlisted'
  | 'public'
const DRY_RUN = process.env.CUTLINE_DRY_RUN === '1' || process.env.CUTLINE_DRY_RUN === 'true'
const MAX_SHORTS_PER_RUN = Number(process.env.CUTLINE_AI_MAX_SHORTS || 3)
const SUBREDDIT = process.env.CUTLINE_TREND_SUBREDDIT || 'technology'

export type TrendTopic = {
  id: string
  title: string
  trend_score?: number
  keywords?: string[]
  pillar?: string
  cta?: string
}

export type ScriptPackage = {
  topic: string
  titles: string[]
  hooks: string[]
  keywords: string[]
  script: string
  shorts_cutdowns: string[]
  mode?: string
  project?: typeof PROJECT
}

type AiPipelineState = {
  processedTopics: Record<string, { at: string; uploads: string[]; topicId?: string }>
  lastRun: string | null
  lastError: string | null
  running: boolean
  mode?: string
}

async function readState(): Promise<AiPipelineState> {
  try {
    return JSON.parse(await fs.readFile(STATE_PATH, 'utf8')) as AiPipelineState
  } catch {
    return { processedTopics: {}, lastRun: null, lastError: null, running: false }
  }
}

async function writeState(state: AiPipelineState) {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2))
}

async function log(line: string) {
  const row = `[${new Date().toISOString()}] ${line}`
  console.log(row)
  await fs.appendFile(LOG_PATH, row + '\n')
}

async function runPython(scriptRel: string, args: string[]) {
  const script = path.join(ROOT, scriptRel)
  await execFileAsync('python3', [script, ...args], {
    cwd: ROOT,
    env: process.env as NodeJS.ProcessEnv,
    maxBuffer: 1024 * 1024 * 10,
  })
}

async function hasToken() {
  try {
    await fs.access(TOKEN_PATH)
    return true
  } catch {
    return false
  }
}

function topicKey(topic: TrendTopic) {
  return createHash('sha1').update(topic.id || topic.title).digest('hex')
}

function buildNarration(pkg: ScriptPackage, cutdownIndex: number): string {
  const hook = pkg.hooks[cutdownIndex % pkg.hooks.length] ?? pkg.hooks[0]
  const lines = pkg.script
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 12 && !line.startsWith('##'))
  const body = lines[cutdownIndex % lines.length] ?? pkg.topic
  const cta = `Learn more at ${PROJECT.site}.`
  return `${hook} ${body} ${cta}`
}

function buildClipMeta(pkg: ScriptPackage, cutdownIndex: number, duration: number): PlannedClip {
  const title = (pkg.titles[cutdownIndex % pkg.titles.length] ?? pkg.topic).slice(0, 95)
  const hook = pkg.hooks[cutdownIndex % pkg.hooks.length] ?? pkg.hooks[0]
  const tags = [
    PROJECT.product,
    PROJECT.brand.replace(/\s+/g, ''),
    ...(pkg.keywords ?? []).slice(0, 5),
    'Shorts',
    'streaming',
  ].slice(0, 8)
  const description = [
    hook,
    '',
    title,
    '',
    `${PROJECT.product} by ${PROJECT.brand} — ${PROJECT.tagline}`,
    PROJECT.siteUrl,
    '',
    'Tell us what to cover next in the comments.',
    '',
    tags.map((t) => `#${t.replace(/\s+/g, '')}`).join(' '),
    '#Shorts',
  ].join('\n')

  return {
    label: `ai_${String(cutdownIndex + 1).padStart(2, '0')}`,
    start: 0,
    end: duration,
    title,
    hook,
    description,
    tags: tags.map((t) => t.replace(/\s+/g, '')),
    cta: `Visit ${PROJECT.site}`,
  }
}

export async function buildProjectTopicQueue(): Promise<TrendTopic[]> {
  const feedback = await runFeedbackLoop()
  const suggestions = new Set(feedback.next_topic_suggestions)

  const ordered = [...PROJECT_TOPICS].sort((a, b) => {
    const aBoost = suggestions.has(a.title) ? 1 : 0
    const bBoost = suggestions.has(b.title) ? 1 : 0
    return bBoost - aBoost
  })

  const topics: TrendTopic[] = ordered.map((t: ProjectTopic) => ({
    id: t.id,
    title: t.title,
    keywords: t.keywords,
    pillar: t.pillar,
    cta: t.cta,
    trend_score: suggestions.has(t.title) ? 99 : 70,
  }))

  await fs.mkdir(INBOX, { recursive: true })
  await fs.writeFile(
    PROJECT_QUEUE,
    JSON.stringify({ generated_at: new Date().toISOString(), topics, feedback }, null, 2),
  )
  return topics
}

export async function runTrendRadar() {
  await log(`Trend radar → r/${SUBREDDIT}`)
  await runPython('scripts/replit/trend_radar.py', ['--subreddit', SUBREDDIT, '--limit', '20'])
}

export async function runProjectScriptFactory(topic: TrendTopic) {
  await log(`Project script → ${topic.title}`)
  await runPython('scripts/ai/project_script_factory.py', [
    '--topic-id',
    topic.id,
    '--title',
    topic.title,
    '--keywords',
    (topic.keywords ?? []).join(','),
    '--out',
    SCRIPT_PACKAGE,
  ])
}

export async function runScriptFactory(topic: TrendTopic) {
  if (MODE === 'project') {
    await runProjectScriptFactory(topic)
    return
  }
  const keywords = (topic.keywords ?? []).join(',')
  await log(`Script factory → ${topic.title}`)
  await runPython('scripts/ai/script_factory.py', [
    '--topic',
    topic.title,
    '--keywords',
    keywords,
    '--out',
    SCRIPT_PACKAGE,
  ])
}

export async function loadTopicQueue(): Promise<TrendTopic[]> {
  if (MODE === 'project') {
    try {
      const raw = JSON.parse(await fs.readFile(PROJECT_QUEUE, 'utf8')) as { topics: TrendTopic[] }
      if (raw.topics?.length) return raw.topics
    } catch {
      // rebuild below
    }
    return buildProjectTopicQueue()
  }
  try {
    const raw = JSON.parse(await fs.readFile(TREND_QUEUE, 'utf8')) as { topics: TrendTopic[] }
    return raw.topics ?? []
  } catch {
    return []
  }
}

export async function loadScriptPackage(): Promise<ScriptPackage | null> {
  try {
    return JSON.parse(await fs.readFile(SCRIPT_PACKAGE, 'utf8')) as ScriptPackage
  } catch {
    return null
  }
}

export async function renderAndUploadTopic(topic: TrendTopic, state: AiPipelineState) {
  const key = topicKey(topic)
  if (state.processedTopics[key]) {
    await log(`Skip already processed topic: ${topic.title}`)
    return
  }

  await runScriptFactory(topic)
  const pkg = await loadScriptPackage()
  if (!pkg) {
    throw new Error('Script package missing after script factory')
  }

  const jobOut = path.join(AI_OUT, key.slice(0, 10))
  await fs.mkdir(jobOut, { recursive: true })
  const uploads: string[] = []
  const shortsToMake = Math.min(MAX_SHORTS_PER_RUN, pkg.shorts_cutdowns.length || 1)

  for (let i = 0; i < shortsToMake; i++) {
    const narration = buildNarration(pkg, i)
    const voicePath = path.join(jobOut, `voice_${i + 1}.mp3`)
    const videoPath = path.join(jobOut, `ai_${String(i + 1).padStart(2, '0')}.mp4`)

    await log(`TTS cutdown ${i + 1}/${shortsToMake}`)
    await runPython('scripts/ai/voice_factory.py', ['--text', narration, '--out', voicePath])

    const duration = await probeDuration(voicePath)
    const clip = buildClipMeta(pkg, i, duration)

    await log(`Rendering ${PROJECT.product} Short: ${clip.title}`)
    await renderAiShort({
      title: clip.title,
      hook: clip.hook,
      subtitle: `${PROJECT.product} · ${pkg.shorts_cutdowns[i] ?? 'Short'}`,
      audioPath: voicePath,
      outPath: videoPath,
      brand: PROJECT.site,
    })

    await log(`Uploading (${PRIVACY}): ${clip.title}`)
    const result = await uploadShort({
      filePath: videoPath,
      clip,
      privacyStatus: PRIVACY,
      dryRun: DRY_RUN || !(await hasToken()),
    })
    uploads.push(String(result.id))
    await log(
      result.dryRun
        ? `Dry-run upload ok: ${result.title}`
        : `Uploaded: ${result.url ?? result.id}`,
    )
    if (!result.dryRun) {
      await moveToUploaded(videoPath, UPLOADED)
    }
  }

  state.processedTopics[key] = {
    at: new Date().toISOString(),
    uploads,
    topicId: topic.id,
  }
  state.lastRun = new Date().toISOString()
  state.lastError = null
  state.mode = MODE
  await writeState(state)

  await fs.writeFile(
    path.join(jobOut, 'manifest.json'),
    JSON.stringify({ topic, package: pkg, uploads, privacy: PRIVACY }, null, 2),
  )
}

export async function runAiPipelineOnce() {
  const state = await readState()
  state.running = true
  await writeState(state)

  try {
    await log(`AI pipeline mode: ${MODE}`)
    await runFeedbackLoop()

    if (MODE === 'project') {
      await buildProjectTopicQueue()
    } else {
      await runTrendRadar()
    }

    const topics = await loadTopicQueue()
    if (!topics.length) {
      await log('No topics in queue')
      return state
    }

    const fresh = topics.filter((t) => !state.processedTopics[topicKey(t)])
    const batch = fresh.slice(0, Math.max(1, Number(process.env.CUTLINE_AI_TOPICS_PER_RUN || 1)))

    for (const topic of batch) {
      await renderAndUploadTopic(topic, state)
    }

    if (!batch.length) {
      await log('All project topics processed — feedback loop will suggest rotations')
      await runFeedbackLoop()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    state.lastError = message
    await writeState(state)
    await log(`ERROR: ${message}`)
    throw err
  } finally {
    state.running = false
    await writeState(state)
  }

  return state
}
