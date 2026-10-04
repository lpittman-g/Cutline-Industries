import { execFile } from 'child_process'
import { writeFile, unlink, rm, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export type SandboxLanguage = 'python' | 'node' | 'bash'

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  elapsed: number
  timedOut: boolean
}

const MAX_TIMEOUT_MS = 30_000
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_OUTPUT_BYTES = 64 * 1024

function ext(lang: SandboxLanguage): string {
  return lang === 'python' ? '.py' : lang === 'node' ? '.js' : '.sh'
}

function runner(lang: SandboxLanguage): [string, string[]] {
  if (lang === 'python') return ['python3', []]
  if (lang === 'node') return ['node', []]
  return ['bash', []]
}

export async function runSandbox(input: {
  language: SandboxLanguage
  code: string
  timeout?: number
}): Promise<SandboxResult> {
  const timeoutMs = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const dir = await mkdtemp(join(tmpdir(), 'artemis-sb-'))
  const file = join(dir, `run${ext(input.language)}`)
  await writeFile(file, input.code, 'utf8')

  const [cmd] = runner(input.language)
  const start = Date.now()

  return new Promise((resolve) => {
    execFile(
      cmd,
      [file],
      { timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, killSignal: 'SIGTERM' },
      (err, stdout, stderr) => {
        const elapsed = Date.now() - start
        void rm(dir, { recursive: true, force: true }).catch(() => undefined)

        const timedOut = !!(err && 'killed' in err && err.killed)
        const exitCode =
          err == null
            ? 0
            : typeof (err as NodeJS.ErrnoException).code === 'number'
              ? ((err as NodeJS.ErrnoException).code as unknown as number)
              : 1

        resolve({
          stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
          stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
          exitCode,
          elapsed,
          timedOut,
        })
      },
    )
  })
}
