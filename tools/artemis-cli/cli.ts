#!/usr/bin/env node
/**
 * Artemis CLI — terminal client for the Artemis AI assistant.
 * Connects to the local Artemis Express backend (port 8787) and streams
 * NDJSON chat responses directly to your terminal.
 *
 * Usage:
 *   npm start                    # connect to http://localhost:8787
 *   npm start -- --url http://...  # custom API base URL
 *   npm start -- --voice astra   # choose a voice (astra | nova | echo | onyx | fable)
 */
import * as p from '@clack/prompts'
import pc from 'picocolors'

// ── Parse flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flagUrl = args[args.indexOf('--url') + 1] ?? ''
const flagVoice = args[args.indexOf('--voice') + 1] ?? 'astra'
const BASE_URL = (flagUrl || process.env.ARTEMIS_API_URL || 'http://localhost:8787').replace(/\/$/, '')

// ── NDJSON stream consumer ────────────────────────────────────────────────────

type StreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'step'; id: string; status: 'in_progress' | 'done' }
  | { type: 'chunk'; text: string }
  | { type: 'done'; conversationId: string }
  | { type: 'error'; error: string }

const STEP_LABELS: Record<string, string> = {
  understand: 'understand',
  chronicle: 'chronicle',
  project: 'project',
  extract: 'extract',
  chunk: 'chunk',
  index: 'index',
  generate: 'generate',
  learn: 'learn',
}

async function streamChat(opts: {
  message: string
  conversationId: string | undefined
  voice: string
  onStep: (id: string, status: 'in_progress' | 'done') => void
  onChunk: (text: string) => void
}): Promise<string | undefined> {
  const res = await fetch(`${BASE_URL}/api/artemis/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: opts.message,
      conversationId: opts.conversationId,
      voice: opts.voice,
    }),
  })

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'no body')}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let nextConvId: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as StreamEvent
        if (ev.type === 'meta' || ev.type === 'done') nextConvId = ev.conversationId
        if (ev.type === 'step') opts.onStep(ev.id, ev.status)
        if (ev.type === 'chunk') opts.onChunk(ev.text)
        if (ev.type === 'error') throw new Error(ev.error)
      } catch {
        // skip malformed line
      }
    }
  }

  return nextConvId
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderStep(id: string, status: 'in_progress' | 'done'): string {
  const label = STEP_LABELS[id] ?? id
  if (status === 'in_progress') return pc.yellow(`[${label}…]`)
  return pc.green(`[${label} ✓]`)
}

// ── Main session loop ─────────────────────────────────────────────────────────

async function main() {
  p.intro(pc.bold(pc.cyan('  Artemis CLI  ')) + pc.dim(`  ${BASE_URL}`))

  let conversationId: string | undefined
  const stepState: Record<string, 'in_progress' | 'done'> = {}

  process.on('SIGINT', () => {
    p.outro(pc.dim('Session ended.'))
    process.exit(0)
  })

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = await p.text({
      message: pc.green('You'),
      placeholder: 'Ask Artemis anything… (type exit to quit)',
      validate: (v) => (v.trim() ? undefined : 'Message cannot be empty.'),
    })

    if (p.isCancel(input)) {
      p.outro(pc.dim('Session ended.'))
      break
    }

    const text = String(input).trim()
    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      p.outro(pc.dim('Session ended.'))
      break
    }

    // Print label
    process.stdout.write('\n' + pc.bold(pc.magenta('Artemis')) + '  ')

    const spinner = p.spinner()
    spinner.start('Thinking…')

    let stepLine = ''
    let replyStarted = false

    try {
      conversationId = await streamChat({
        message: text,
        conversationId,
        voice: flagVoice,
        onStep(id, status) {
          stepState[id] = status
          const parts = Object.entries(stepState).map(([k, v]) => renderStep(k, v))
          stepLine = parts.join(' ')
          spinner.message(stepLine || 'Thinking…')
        },
        onChunk(chunk) {
          if (!replyStarted) {
            spinner.stop(stepLine || '')
            process.stdout.write('\n')
            replyStarted = true
          }
          process.stdout.write(chunk)
        },
      })

      if (!replyStarted) spinner.stop('')
      process.stdout.write('\n\n')
      if (conversationId) {
        process.stdout.write(pc.dim(`  ↳ conversation: ${conversationId}\n\n`))
      }
    } catch (err) {
      spinner.stop(pc.red('Error'))
      p.log.error(err instanceof Error ? err.message : String(err))
    }
  }
}

main().catch((err: unknown) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)))
  process.exit(1)
})
