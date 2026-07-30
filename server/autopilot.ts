import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { cutVerticalShort, probeDuration } from './ffmpegCut.ts'
import { planClipsFromDuration, type PlannedClip } from './planClips.ts'
import { moveToUploaded, uploadShort } from './youtubeUpload.ts'
import { ROOT, TOKEN_PATH } from './youtubeAuth.ts'
import type { GameNiche } from '../src/types.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const INBOX = path.join(ROOT, 'inbox')
const OUT = path.join(ROOT, 'shorts_out')
const UPLOADED = path.join(ROOT, 'uploaded')
const STATE_PATH = path.join(ROOT, 'autopilot-state.json')
const LOG_PATH = path.join(ROOT, 'autopilot.log')

const GAME = process.env.CUTLINE_GAME || 'Valorant'
const NICHE = (process.env.CUTLINE_NICHE || 'fps') as GameNiche
const MAX_CLIPS = Number(process.env.CUTLINE_MAX_CLIPS || 8)
const CLIP_SECONDS = Number(process.env.CUTLINE_CLIP_SECONDS || 22)
const POLL_MS = Number(process.env.CUTLINE_POLL_MS || 60_000)
const PRIVACY = (process.env.CUTLINE_PRIVACY || 'private') as 'private' | 'unlisted' | 'public'
const DRY_RUN = process.env.CUTLINE_DRY_RUN === '1' || process.env.CUTLINE_DRY_RUN === 'true'

type AutopilotState = {
  processed: Record<string, { at: string; uploads: string[] }>
  lastRun: string | null
  lastError: string | null
  running: boolean
}

async function readState(): Promise<AutopilotState> {
  try {
    return JSON.parse(await fs.readFile(STATE_PATH, 'utf8')) as AutopilotState
  } catch {
    return { processed: {}, lastRun: null, lastError: null, running: false }
  }
}

async function writeState(state: AutopilotState) {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2))
}

async function log(line: string) {
  const row = `[${new Date().toISOString()}] ${line}`
  console.log(row)
  await fs.appendFile(LOG_PATH, row + '\n')
}

function fileKey(filePath: string, size: number) {
  return createHash('sha1').update(`${filePath}:${size}`).digest('hex')
}

async function listInboxVideos() {
  await fs.mkdir(INBOX, { recursive: true })
  const entries = await fs.readdir(INBOX)
  return entries
    .filter((f) => /\.(mp4|mov|mkv|webm)$/i.test(f))
    .map((f) => path.join(INBOX, f))
}

async function processVod(filePath: string, state: AutopilotState) {
  const stat = await fs.stat(filePath)
  const key = fileKey(filePath, stat.size)
  if (state.processed[key]) {
    await log(`Skip already processed: ${path.basename(filePath)}`)
    return
  }

  await log(`Processing ${path.basename(filePath)}`)
  const duration = await probeDuration(filePath)
  const clips = planClipsFromDuration({
    duration,
    game: GAME,
    niche: NICHE,
    maxClips: MAX_CLIPS,
    clipSeconds: CLIP_SECONDS,
  })

  if (!clips.length) {
    await log(`No clips planned for ${filePath}`)
    return
  }

  const jobOut = path.join(OUT, path.parse(filePath).name)
  await fs.mkdir(jobOut, { recursive: true })
  const uploads: string[] = []

  for (const clip of clips) {
    await log(`Cutting ${clip.label} ${clip.start}-${clip.end}s`)
    const outFile = await cutVerticalShort(filePath, clip, jobOut)
    await log(`Uploading ${clip.title}`)
    const result = await uploadShort({
      filePath: outFile,
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
      await moveToUploaded(outFile, path.join(UPLOADED, path.parse(filePath).name))
    }
  }

  state.processed[key] = { at: new Date().toISOString(), uploads }
  state.lastRun = new Date().toISOString()
  state.lastError = null
  await writeState(state)
  await fs.writeFile(
    path.join(jobOut, 'manifest.json'),
    JSON.stringify({ filePath, game: GAME, niche: NICHE, clips, uploads }, null, 2),
  )
}

async function hasToken() {
  try {
    await fs.access(TOKEN_PATH)
    return true
  } catch {
    return false
  }
}

export async function runOnce() {
  const state = await readState()
  state.running = true
  await writeState(state)
  try {
    const files = await listInboxVideos()
    if (!files.length) {
      await log('Inbox empty — waiting for VODs')
    }
    for (const file of files) {
      await processVod(file, state)
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
}

async function loop() {
  await log(
    `CUTLINE Autopilot started (dryRun=${DRY_RUN}, privacy=${PRIVACY}, every ${POLL_MS}ms)`,
  )
  for (;;) {
    try {
      await runOnce()
    } catch {
      // already logged
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const once = process.argv.includes('--once')
  ;(once ? runOnce() : loop()).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

export type { PlannedClip }
