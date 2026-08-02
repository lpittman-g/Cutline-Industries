import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import dotenv from 'dotenv'
import { probeDuration } from './ffmpegCut.ts'
import { renderAiShort } from './renderAiShort.ts'
import type { PlannedClip } from './planClips.ts'
import { moveToUploaded, uploadShort } from './youtubeUpload.ts'
import { ROOT, TOKEN_PATH } from './youtubeAuth.ts'
import { HASHTAG_SETS } from '../src/data/catalog.ts'
import type { GameNiche } from '../src/types.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const execFileAsync = promisify(execFile)

const INBOX = path.join(ROOT, 'inbox')
const AI_OUT = path.join(ROOT, 'ai_out')
const UPLOADED = path.join(ROOT, 'uploaded', 'ai')
const STATE_PATH = path.join(ROOT, 'ai-pipeline-state.json')
const LOG_PATH = path.join(ROOT, 'ai-pipeline.log')
const TREND_QUEUE = path.join(INBOX, 'trend_queue.json')
const SCRIPT_PACKAGE = path.join(INBOX, 'script_package.json')

const GAME = process.env.CUTLINE_GAME || 'Valorant'
const NICHE = (process.env.CUTLINE_NICHE || 'fps') as GameNiche
const PRIVACY = (process.env.CUTLINE_PRIVACY || 'private') as 'private' | 'unlisted' | 'public'
const DRY_RUN = process.env.CUTLINE_DRY_RUN === '1' || process.env.CUTLINE_DRY_RUN === 'true'
const MAX_SHORTS_PER_RUN = Number(process.env.CUTLINE_AI_MAX_SHORTS || 3)
const SUBREDDIT = process.env.CUTLINE_TREND_SUBREDDIT || 'gaming'

export type TrendTopic = {
  id: string
  title: string
  trend_score?: number
  keywords?: string[]
}

export type ScriptPackage = {
  topic: string
  titles: string[]
  hooks: string[]
  keywords: string[]
  script: string
  shorts_cutdowns: string[]
  mode?: string
}

type AiPipelineState = {
  processedTopics: Record<string, { at: string; uploads: string[] }>
  lastRun: string | null
  lastError: string | null
  running: boolean
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
  const title = pkg.titles[cutdownIndex % pkg.titles.length] ?? pkg.topic
  const framework = pkg.script
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 12 && !line.startsWith('##'))
    .slice(0, 2)
  const body = framework[cutdownIndex % framework.length] ?? framework[0] ?? title
  return `${hook} ${body} Follow for more ${GAME} Shorts.`
}

function buildClipMeta(pkg: ScriptPackage, cutdownIndex: number, duration: number): PlannedClip {
  const title = (pkg.titles[cutdownIndex % pkg.titles.length] ?? pkg.topic).slice(0, 95)
  const hook = pkg.hooks[cutdownIndex % pkg.hooks.length] ?? pkg.hooks[0]
  const tags = [
    GAME.replace(/[^a-zA-Z0-9]/g, ''),
    ...(pkg.keywords ?? []).slice(0, 4),
    ...HASHTAG_SETS[NICHE].map((t) => t.replace(/^#/, '')),
  ].slice(0, 8)
  const description = [hook, '', title, '', `Game: ${GAME}`, 'Subscribe for daily AI Shorts.', '', tags.map((t) => `#${t}`).join(' ')].join('\n')

  return {
    label: `ai_${String(cutdownIndex + 1).padStart(2, '0')}`,
    start: 0,
    end: duration,
    title,
    hook,
    description,
    tags,
    cta: 'Subscribe for daily Shorts',
  }
}

export async function runTrendRadar() {
  await log(`Trend radar → r/${SUBREDDIT}`)
  await runPython('scripts/replit/trend_radar.py', ['--subreddit', SUBREDDIT, '--limit', '20'])
}

export async function runScriptFactory(topic: TrendTopic) {
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

export async function loadTrendQueue(): Promise<TrendTopic[]> {
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
    throw new Error('Script package missing after script_factory')
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

    await log(`Rendering AI Short: ${clip.title}`)
    await renderAiShort({
      title: clip.title,
      hook: clip.hook,
      subtitle: pkg.shorts_cutdowns[i] ?? 'Gaming Short',
      audioPath: voicePath,
      outPath: videoPath,
    })

    await log(`Uploading ${clip.title}`)
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

  state.processedTopics[key] = { at: new Date().toISOString(), uploads }
  state.lastRun = new Date().toISOString()
  state.lastError = null
  await writeState(state)

  await fs.writeFile(
    path.join(jobOut, 'manifest.json'),
    JSON.stringify({ topic, package: pkg, uploads }, null, 2),
  )
}

export async function runAiPipelineOnce() {
  const state = await readState()
  state.running = true
  await writeState(state)

  try {
    await runTrendRadar()
    const topics = await loadTrendQueue()
    if (!topics.length) {
      await log('No topics in trend queue')
      return state
    }

    const fresh = topics.filter((t) => !state.processedTopics[topicKey(t)])
    const batch = fresh.slice(0, Math.max(1, Number(process.env.CUTLINE_AI_TOPICS_PER_RUN || 1)))

    for (const topic of batch) {
      await renderAndUploadTopic(topic, state)
    }

    if (!batch.length) {
      await log('All queued topics already processed — waiting for new trends')
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
