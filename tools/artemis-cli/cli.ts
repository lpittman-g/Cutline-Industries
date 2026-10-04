#!/usr/bin/env node
/**
 * Artemis CLI — terminal client for the Artemis AI assistant.
 *
 * Usage:
 *   npm start                        # connect to http://localhost:8787
 *   npm start -- --url http://...    # custom API base URL
 *   npm start -- --voice nova        # choose voice
 *   npm start -- --logout            # clear stored session
 */
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flag = (name: string) => args[args.indexOf(name) + 1] ?? ''
const BASE_URL = (flag('--url') || process.env.ARTEMIS_API_URL || 'http://localhost:8787').replace(/\/$/, '')
const VOICE = flag('--voice') || 'astra'
const LOGOUT = args.includes('--logout')

const CONFIG_DIR = join(homedir(), '.config', 'artemis-cli')
const SESSION_FILE = join(CONFIG_DIR, 'session')
const COOKIE_NAME = 'cutline_session'

// ── Session storage ───────────────────────────────────────────────────────────

async function loadSession(): Promise<string | null> {
  try {
    return (await readFile(SESSION_FILE, 'utf8')).trim() || null
  } catch {
    return null
  }
}

async function saveSession(token: string) {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(SESSION_FILE, token, { mode: 0o600 })
}

async function clearSession() {
  try {
    await writeFile(SESSION_FILE, '', { mode: 0o600 })
  } catch {
    /* ignore */
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function signin(): Promise<string> {
  p.log.info('Sign in to Artemis')

  const email = await p.text({ message: 'Email', placeholder: 'you@example.com' })
  if (p.isCancel(email)) process.exit(0)

  const password = await p.password({ message: 'Password' })
  if (p.isCancel(password)) process.exit(0)

  const s = p.spinner()
  s.start('Signing in…')

  // First attempt without MFA
  let body: Record<string, string> = { email: String(email), password: String(password) }
  let res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 401) {
    const data = (await res.json()) as { mfaRequired?: boolean; error?: string }
    if (data.mfaRequired) {
      s.stop('MFA required')
      const mfaCode = await p.text({ message: 'Authenticator code or recovery code' })
      if (p.isCancel(mfaCode)) process.exit(0)
      body = { ...body, mfaCode: String(mfaCode) }
      s.start('Signing in…')
      res = await fetch(`${BASE_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
  }

  if (!res.ok) {
    s.stop(pc.red('Sign in failed'))
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  // Extract session cookie from Set-Cookie header
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = new RegExp(`${COOKIE_NAME}=([^;]+)`).exec(setCookie)
  if (!match) {
    s.stop(pc.red('No session cookie returned'))
    throw new Error('Sign in succeeded but no session cookie received')
  }

  const token = match[1]
  await saveSession(token)
  s.stop(pc.green('Signed in'))
  return token
}

// ── Streaming chat ────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  understand: 'understand', chronicle: 'chronicle', project: 'project',
  extract: 'extract', chunk: 'chunk', index: 'index', generate: 'generate', learn: 'learn',
}

type StreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'step'; id: string; status: 'in_progress' | 'done' }
  | { type: 'chunk'; text: string }
  | { type: 'done'; conversationId: string }
  | { type: 'error'; error: string }

async function streamChat(opts: {
  message: string
  conversationId: string | undefined
  voice: string
  sessionToken: string
  onStep: (id: string, status: 'in_progress' | 'done') => void
  onChunk: (text: string) => void
}): Promise<{ conversationId: string | undefined; unauthorized: boolean }> {
  const res = await fetch(`${BASE_URL}/api/artemis/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${COOKIE_NAME}=${opts.sessionToken}`,
    },
    body: JSON.stringify({ message: opts.message, conversationId: opts.conversationId, voice: opts.voice }),
  })

  if (res.status === 401) return { conversationId: opts.conversationId, unauthorized: true }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let nextConvId: string | undefined = opts.conversationId

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
        /* skip malformed line */
      }
    }
  }

  return { conversationId: nextConvId, unauthorized: false }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (LOGOUT) {
    await clearSession()
    console.log(pc.dim('Session cleared.'))
    return
  }

  p.intro(pc.bold(pc.cyan('  Artemis CLI  ')) + pc.dim(`  ${BASE_URL}`))

  let sessionToken = await loadSession()
  if (!sessionToken) sessionToken = await signin()

  let conversationId: string | undefined
  const stepState: Record<string, 'in_progress' | 'done'> = {}

  process.on('SIGINT', () => { p.outro(pc.dim('Session ended.')); process.exit(0) })

  while (true) {
    const input = await p.text({
      message: pc.green('You'),
      placeholder: 'Ask Artemis anything… (exit to quit)',
      validate: (v) => (v.trim() ? undefined : 'Message cannot be empty.'),
    })

    if (p.isCancel(input)) { p.outro(pc.dim('Session ended.')); break }

    const text = String(input).trim()
    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      p.outro(pc.dim('Session ended.'))
      break
    }

    process.stdout.write('\n' + pc.bold(pc.magenta('Artemis')) + '  ')

    const spinner = p.spinner()
    spinner.start('Thinking…')

    let replyStarted = false

    try {
      const result = await streamChat({
        message: text,
        conversationId,
        voice: VOICE,
        sessionToken,
        onStep(id, status) {
          stepState[id] = status
          const parts = Object.entries(stepState).map(([k, v]) =>
            v === 'in_progress' ? pc.yellow(`[${STEP_LABELS[k] ?? k}…]`) : pc.green(`[${STEP_LABELS[k] ?? k} ✓]`),
          )
          spinner.message(parts.join(' ') || 'Thinking…')
        },
        onChunk(chunk) {
          if (!replyStarted) {
            spinner.stop(Object.entries(stepState).map(([k, v]) =>
              v === 'in_progress' ? pc.yellow(`[${STEP_LABELS[k] ?? k}…]`) : pc.green(`[${STEP_LABELS[k] ?? k} ✓]`),
            ).join(' '))
            process.stdout.write('\n')
            replyStarted = true
          }
          process.stdout.write(chunk)
        },
      })

      if (!replyStarted) spinner.stop('')

      if (result.unauthorized) {
        process.stdout.write('\n')
        p.log.warn('Session expired — signing in again')
        await clearSession()
        sessionToken = await signin()
        continue
      }

      conversationId = result.conversationId
      process.stdout.write('\n\n')
      if (conversationId) process.stdout.write(pc.dim(`  ↳ conversation: ${conversationId}\n\n`))
    } catch (err) {
      if (!replyStarted) spinner.stop(pc.red('Error'))
      p.log.error(err instanceof Error ? err.message : String(err))
    }
  }
}

main().catch((err: unknown) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)))
  process.exit(1)
})
