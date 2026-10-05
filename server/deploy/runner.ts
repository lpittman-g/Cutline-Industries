/**
 * Build and deploy runner — executes entirely inside the Artemis network.
 * No GitHub Actions, no Vercel, no external CI. Builds run as child processes
 * on the same VPS, deploy via docker compose.
 */
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { EventEmitter } from 'node:events'
import { saveDeployment, appendLog, type Deployment, type Project } from './store.ts'

export const buildBus = new EventEmitter()
buildBus.setMaxListeners(50)

const activeBuilds = new Map<string, boolean>()

function emit(deployId: string, line: string) {
  buildBus.emit(`log:${deployId}`, line)
}

async function run(
  cmd: string,
  args: string[],
  cwd: string,
  deployId: string,
  env?: Record<string, string>,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const handle = (data: Buffer) => {
      const line = data.toString().trimEnd()
      appendLog(deployId, line)
      emit(deployId, line)
    }
    child.stdout.on('data', handle)
    child.stderr.on('data', handle)
    child.on('error', reject)
    child.on('close', resolve)
  })
}

export async function executeDeploy(project: Project, dep: Deployment): Promise<void> {
  if (activeBuilds.get(dep.id)) return
  activeBuilds.set(dep.id, true)

  const log = (line: string) => { appendLog(dep.id, line); emit(dep.id, line) }
  const projectDir = project.rootDir || process.cwd()

  async function finish(status: 'ready' | 'error') {
    dep.status = status
    dep.finishedAt = new Date().toISOString()
    dep.duration = Math.round((Date.now() - new Date(dep.startedAt).getTime()) / 1000)
    await saveDeployment(dep)
    activeBuilds.delete(dep.id)
    buildBus.emit(`done:${dep.id}`, status)
    log(`\n${status === 'ready' ? '✓' : '✕'} Deploy ${status === 'ready' ? 'complete' : 'failed'} in ${dep.duration}s`)
  }

  try {
    dep.status = 'building'
    await saveDeployment(dep)

    log(`[${new Date().toISOString()}] Starting build for ${project.name}`)
    log(`$ ${project.buildCmd}`)

    // Install deps
    const installCode = await run('npm', ['ci', '--prefer-offline'], projectDir, dep.id)
    if (installCode !== 0) { await finish('error'); return }

    // Run typecheck if available
    const pkgRaw = await fs.readFile(`${projectDir}/package.json`, 'utf8').catch(() => '{}')
    const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> }
    if (pkg.scripts?.typecheck) {
      log('$ npm run typecheck')
      const tcCode = await run('npm', ['run', 'typecheck'], projectDir, dep.id)
      if (tcCode !== 0) { await finish('error'); return }
    }

    // Build
    if (pkg.scripts?.build) {
      log(`$ ${project.buildCmd}`)
      const buildCode = await run('npm', ['run', 'build'], projectDir, dep.id, {
        NODE_ENV: 'production',
        VITE_API_URL: '',
      })
      if (buildCode !== 0) { await finish('error'); return }
    }

    // Docker compose up
    log('$ docker compose up -d --build --remove-orphans')
    const dockerCode = await run(
      'docker',
      ['compose', 'up', '-d', '--build', '--remove-orphans'],
      projectDir,
      dep.id,
    )
    if (dockerCode !== 0) { await finish('error'); return }

    // DB migrate if available
    if (pkg.scripts?.['db:migrate'] || await fs.access(`${projectDir}/db/migrate.ts`).then(() => true).catch(() => false)) {
      log('$ node --import tsx/esm db/migrate.ts')
      await run('node', ['--import', 'tsx/esm', 'db/migrate.ts'], projectDir, dep.id).catch(() => {})
    }

    await finish('ready')
  } catch (err) {
    log(`Error: ${err instanceof Error ? err.message : String(err)}`)
    await finish('error')
  }
}

export function isBuilding(deployId: string) {
  return activeBuilds.get(deployId) === true
}
