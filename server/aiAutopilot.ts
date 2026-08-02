import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { runAiPipelineOnce } from './aiPipeline.ts'
import { ROOT } from './youtubeAuth.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const POLL_MS = Number(process.env.CUTLINE_AI_POLL_MS || 300_000)

async function log(line: string) {
  const row = `[${new Date().toISOString()}] ${line}`
  console.log(row)
  const { appendFile } = await import('node:fs/promises')
  await appendFile(path.join(ROOT, 'ai-pipeline.log'), row + '\n')
}

async function loop() {
  await log(`AI Video Autopilot started (poll every ${POLL_MS}ms)`)
  for (;;) {
    try {
      await runAiPipelineOnce()
    } catch {
      // logged in aiPipeline
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const once = process.argv.includes('--once')
  ;(once ? runAiPipelineOnce() : loop()).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
