#!/usr/bin/env node
/**
 * cursor-env — view Cutline's Cursor Cloud environment config from the terminal.
 *
 *   npm run env:view
 *   npm run env:view -- --json
 *   npm run env:view -- agents   # needs CURSOR_API_KEY
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEnvironmentView, formatEnvironmentView, DASHBOARD_ENVIRONMENTS_URL } from './view.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

type CloudAgentListItem = {
  id?: string
  name?: string
  status?: string
  url?: string
  createdAt?: string
  env?: { type?: string; name?: string }
  repos?: Array<{ url?: string }>
}

function usage(): never {
  console.log(`Usage:
  npm run env:view              Show .cursor/environment.json + local probes
  npm run env:view -- --json    Machine-readable JSON
  npm run env:view -- agents    List recent Cloud Agents (needs CURSOR_API_KEY)
  npm run env:view -- open      Print Cloud Agents environments dashboard URL

No rebuild required to view. Rebuild only when install/start/snapshot change.`)
  process.exit(0)
}

function apiKey(): string | null {
  return process.env.CURSOR_API_KEY?.trim() || process.env.CURSOR_CLOUD_API_KEY?.trim() || null
}

async function listCloudAgents(limit = 10): Promise<void> {
  const key = apiKey()
  if (!key) {
    console.error(
      'Missing CURSOR_API_KEY (or CURSOR_CLOUD_API_KEY).\nCreate one at https://cursor.com/dashboard/api',
    )
    process.exit(1)
  }

  const url = new URL('https://api.cursor.com/v1/agents')
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Cloud Agents API ${res.status}: ${body.slice(0, 400)}`)
    process.exit(1)
  }

  const data = (await res.json()) as { agents?: CloudAgentListItem[]; items?: CloudAgentListItem[] }
  const agents = data.agents ?? data.items ?? []

  console.log(`Recent Cloud Agents (${agents.length})`)
  console.log('──────────────────────────')
  if (!agents.length) {
    console.log('(none)')
    return
  }
  for (const a of agents) {
    const envName = a.env?.name ? ` env=${a.env.name}` : a.env?.type ? ` env=${a.env.type}` : ''
    const repo = a.repos?.[0]?.url ? ` ${a.repos[0].url}` : ''
    console.log(`• ${a.status ?? '?'}  ${a.name ?? a.id ?? '(unnamed)'}${envName}`)
    if (a.url) console.log(`  ${a.url}`)
    if (repo) console.log(`  ${repo}`)
  }
  console.log('')
  console.log(
    'Note: Builds / snapshots are not on the public Agents API — use npm run env:view or the dashboard.',
  )
  console.log(DASHBOARD_ENVIRONMENTS_URL)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const json = args.includes('--json')
  const cmd = args.find((a) => !a.startsWith('-')) ?? 'view'

  if (cmd === 'help' || args.includes('-h') || args.includes('--help')) usage()

  if (cmd === 'open') {
    console.log(DASHBOARD_ENVIRONMENTS_URL)
    return
  }

  if (cmd === 'agents') {
    await listCloudAgents()
    return
  }

  if (cmd !== 'view') {
    console.error(`Unknown command: ${cmd}`)
    usage()
  }

  const view = await buildEnvironmentView(REPO_ROOT)
  if (json) {
    console.log(JSON.stringify(view, null, 2))
    return
  }
  console.log(formatEnvironmentView(view))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
