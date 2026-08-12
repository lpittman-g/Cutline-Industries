import { promises as fs } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { EnvironmentJson, EnvironmentView, ProbeResult } from './types.ts'

export const DASHBOARD_ENVIRONMENTS_URL =
  'https://cursor.com/dashboard/cloud-agents#environments'

export const CLOUD_NOTE =
  'Cursor has no public API for environment Builds. Use this CLI for local config + service status; open the dashboard (or ask a Cloud Agent) for Builds history.'

export function resolveConfigPath(repoRoot: string): string {
  return path.join(repoRoot, '.cursor', 'environment.json')
}

export async function loadEnvironmentJson(
  configPath: string,
): Promise<{ config: EnvironmentJson | null; parseError: string | null; exists: boolean }> {
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    try {
      const config = JSON.parse(raw) as EnvironmentJson
      return { config, parseError: null, exists: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { config: null, parseError: message, exists: true }
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return { config: null, parseError: null, exists: false }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { config: null, parseError: message, exists: false }
  }
}

export function probeTcp(host: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false))
    socket.on('error', () => done(false))
  })
}

function probeCommand(label: string, command: string, args: string[]): ProbeResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 5000,
  })
  if (result.error) {
    return {
      id: label,
      label,
      ok: false,
      detail: result.error.message,
    }
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || `exit ${result.status}`).trim()
    return { id: label, label, ok: false, detail: err.split('\n')[0] || `exit ${result.status}` }
  }
  return {
    id: label,
    label,
    ok: true,
    detail: (result.stdout || 'ok').trim().split('\n')[0] || 'ok',
  }
}

export async function collectLocalProbes(repoRoot: string): Promise<ProbeResult[]> {
  const probes: ProbeResult[] = []

  const envPath = path.join(repoRoot, '.env')
  try {
    await fs.access(envPath)
    probes.push({ id: 'dotenv', label: '.env', ok: true, detail: 'present' })
  } catch {
    probes.push({
      id: 'dotenv',
      label: '.env',
      ok: false,
      detail: 'missing (copy from .env.example)',
    })
  }

  const nmPath = path.join(repoRoot, 'node_modules')
  try {
    await fs.access(nmPath)
    probes.push({ id: 'node_modules', label: 'node_modules', ok: true, detail: 'present' })
  } catch {
    probes.push({
      id: 'node_modules',
      label: 'node_modules',
      ok: false,
      detail: 'missing (run npm install)',
    })
  }

  const pg = probeCommand('postgres', 'pg_isready', ['-h', '127.0.0.1', '-p', '5432'])
  if (pg.ok) {
    probes.push({ id: 'postgres', label: 'postgres :5432', ok: true, detail: 'accepting connections' })
  } else {
    // Distinguish "not installed" vs "down"
    const which = spawnSync('which', ['pg_isready'], { encoding: 'utf8' })
    probes.push({
      id: 'postgres',
      label: 'postgres :5432',
      ok: false,
      detail:
        which.status === 0
          ? 'not accepting connections (try: bash scripts/cloud-postgres.sh start)'
          : 'pg_isready not found (Postgres not installed?)',
    })
  }

  const apiUp = await probeTcp('127.0.0.1', 8787)
  probes.push({
    id: 'api',
    label: 'api :8787',
    ok: apiUp,
    detail: apiUp ? 'listening' : 'down (npm run start / npm run api)',
  })

  const viteUp = await probeTcp('127.0.0.1', 5173)
  probes.push({
    id: 'vite',
    label: 'vite :5173',
    ok: viteUp,
    detail: viteUp ? 'listening' : 'down (npm run start / npm run dev)',
  })

  return probes
}

export async function buildEnvironmentView(repoRoot: string): Promise<EnvironmentView> {
  const configPath = resolveConfigPath(repoRoot)
  const loaded = await loadEnvironmentJson(configPath)
  const probes = await collectLocalProbes(repoRoot)
  return {
    configPath,
    configExists: loaded.exists,
    config: loaded.config,
    parseError: loaded.parseError,
    dashboardUrl: DASHBOARD_ENVIRONMENTS_URL,
    probes,
    cloudNote: CLOUD_NOTE,
  }
}

export function formatEnvironmentView(view: EnvironmentView): string {
  const lines: string[] = []
  lines.push('Cutline Cursor environment')
  lines.push('──────────────────────────')
  lines.push(`Config:  ${view.configPath}`)

  if (!view.configExists) {
    lines.push('Status:  missing (.cursor/environment.json not found)')
  } else if (view.parseError) {
    lines.push(`Status:  invalid JSON (${view.parseError})`)
  } else if (view.config) {
    const c = view.config
    lines.push(`Name:    ${c.name ?? '(unnamed)'}`)
    if (c.snapshot) lines.push(`Snapshot: ${c.snapshot}`)
    if (c.build?.dockerfile) {
      lines.push(`Dockerfile: ${c.build.dockerfile}${c.build.context ? ` (context ${c.build.context})` : ''}`)
    }
    if (c.agentCanUpdateSnapshot != null) {
      lines.push(`Agent can update snapshot: ${c.agentCanUpdateSnapshot ? 'yes' : 'no'}`)
    }
    lines.push('')
    lines.push('Install:')
    for (const line of String(c.install ?? '(none)').split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('Start:')
    for (const line of String(c.start ?? '(none)').split('\n')) {
      lines.push(`  ${line}`)
    }
    if (c.terminals?.length) {
      lines.push('Terminals:')
      for (const t of c.terminals) {
        const bits = [t.name, t.command, t.description ? `(${t.description})` : '']
          .filter(Boolean)
          .join('  ')
        lines.push(`  ${bits}`)
      }
    }
    if (c.ports?.length) {
      lines.push(
        `Ports:   ${c.ports.map((p) => `${p.name ?? 'port'} ${p.port ?? '?'}`).join(' · ')}`,
      )
    }
  }

  lines.push('')
  lines.push('Local status:')
  for (const p of view.probes) {
    lines.push(`  ${p.ok ? '✓' : '·'} ${p.label.padEnd(18)} ${p.detail}`)
  }

  lines.push('')
  lines.push(`Dashboard: ${view.dashboardUrl}`)
  lines.push('')
  lines.push(view.cloudNote)
  return lines.join('\n')
}
