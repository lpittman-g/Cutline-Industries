import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Sentry from '@sentry/node'
import dotenv from 'dotenv'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env') })

let initialized = false

export function sentryDsn(): string {
  return process.env.SENTRY_DSN?.trim() ?? ''
}

export function sentryEnabled(): boolean {
  return Boolean(sentryDsn())
}

export function sentryTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE
  if (raw == null || raw.trim() === '') return 1
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 1
}

export function sentryEnvironment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV?.trim() ||
    'development'
  )
}

/** Options passed to `Sentry.init`. `null` when no DSN — do not initialize. */
export function sentryInitOptions(): Parameters<typeof Sentry.init>[0] | null {
  const dsn = sentryDsn()
  if (!dsn) return null
  return {
    dsn,
    environment: sentryEnvironment(),
    tracesSampleRate: sentryTracesSampleRate(),
    sendDefaultPii: false,
  }
}

export function initSentry(): boolean {
  if (initialized) return sentryEnabled()
  initialized = true
  const options = sentryInitOptions()
  if (!options) return false
  Sentry.init(options)
  return true
}

export function setupSentryExpressErrorHandler(
  app: Parameters<typeof Sentry.setupExpressErrorHandler>[0],
): void {
  if (!sentryEnabled()) return
  Sentry.setupExpressErrorHandler(app)
}

initSentry()
