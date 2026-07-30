import { promises as fs } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { runOnce } from './autopilot.ts'
import { ROOT, saveTokenFromRefresh, TOKEN_PATH, SECRET_PATH } from './youtubeAuth.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const app = express()
const PORT = Number(process.env.CUTLINE_API_PORT || 8787)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

async function readJsonSafe<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, brand: 'Cutline Industries', service: 'cutline-autopilot' })
})

app.get('/api/autopilot/status', async (_req, res) => {
  const state = await readJsonSafe(path.join(ROOT, 'autopilot-state.json'), {
    processed: {},
    lastRun: null,
    lastError: null,
    running: false,
  })
  let hasSecret = false
  let hasToken = false
  try {
    await fs.access(SECRET_PATH)
    hasSecret = true
  } catch {
    hasSecret = false
  }
  try {
    await fs.access(TOKEN_PATH)
    hasToken = true
  } catch {
    hasToken = false
  }

  let inbox: string[] = []
  try {
    inbox = (await fs.readdir(path.join(ROOT, 'inbox'))).filter((f) =>
      /\.(mp4|mov|mkv|webm)$/i.test(f),
    )
  } catch {
    inbox = []
  }

  let logTail = ''
  try {
    const log = await fs.readFile(path.join(ROOT, 'autopilot.log'), 'utf8')
    logTail = log.trim().split('\n').slice(-30).join('\n')
  } catch {
    logTail = ''
  }

  res.json({
    brand: 'Cutline Industries',
    domain: 'cutline-industries.studio',
    hasSecret,
    hasToken,
    dryRun: process.env.CUTLINE_DRY_RUN === '1' || !hasToken,
    privacy: process.env.CUTLINE_PRIVACY || 'private',
    game: process.env.CUTLINE_GAME || 'Valorant',
    niche: process.env.CUTLINE_NICHE || 'fps',
    inboxCount: inbox.length,
    inbox,
    state,
    logTail,
  })
})

app.post('/api/autopilot/token', async (req, res) => {
  try {
    const refreshToken = String(req.body?.refresh_token || '').trim()
    if (!refreshToken) {
      res.status(400).json({ error: 'refresh_token required' })
      return
    }
    await saveTokenFromRefresh(refreshToken)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/autopilot/run-once', async (_req, res) => {
  try {
    await runOnce()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`Cutline Industries API on http://127.0.0.1:${PORT}`)
})
