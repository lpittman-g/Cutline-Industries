/**
 * File-backed store for Cutline Platform projects and deployments.
 * Persists to DATA_ROOT/deploy/ — mounted as a Docker volume in production.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DATA_ROOT } from '../createApp.ts'

const DIR = path.join(DATA_ROOT, 'deploy')

export type ProjectEnv = { key: string; value: string; target: 'production' | 'preview' | 'development' }

export type Project = {
  id: string
  name: string
  description: string
  domain: string
  buildCmd: string
  outputDir: string
  rootDir: string
  envVars: ProjectEnv[]
  createdAt: string
  updatedAt: string
}

export type Deployment = {
  id: string
  projectId: string
  status: 'queued' | 'building' | 'ready' | 'error' | 'cancelled'
  trigger: 'manual' | 'webhook' | 'api'
  message: string
  sha: string
  author: string
  branch: string
  duration: number | null
  startedAt: string
  finishedAt: string | null
  logFile: string
}

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true })
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T }
  catch { return fallback }
}

async function writeJson(file: string, data: unknown) {
  await ensureDir()
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  return readJson(path.join(DIR, 'projects.json'), [])
}

export async function getProject(id: string): Promise<Project | null> {
  const all = await getProjects()
  return all.find(p => p.id === id) ?? null
}

export async function saveProject(project: Project): Promise<Project> {
  const all = await getProjects()
  const idx = all.findIndex(p => p.id === project.id)
  if (idx >= 0) all[idx] = project; else all.push(project)
  await writeJson(path.join(DIR, 'projects.json'), all)
  return project
}

export async function deleteProject(id: string): Promise<boolean> {
  const all = await getProjects()
  const next = all.filter(p => p.id !== id)
  if (next.length === all.length) return false
  await writeJson(path.join(DIR, 'projects.json'), next)
  return true
}

// ── Deployments ───────────────────────────────────────────────────────────────

function deployFile(projectId: string) {
  return path.join(DIR, `deploys-${projectId}.json`)
}

export async function getDeployments(projectId: string): Promise<Deployment[]> {
  return readJson(deployFile(projectId), [])
}

export async function getDeployment(projectId: string, id: string): Promise<Deployment | null> {
  const all = await getDeployments(projectId)
  return all.find(d => d.id === id) ?? null
}

export async function saveDeployment(dep: Deployment): Promise<Deployment> {
  const all = await getDeployments(dep.projectId)
  const idx = all.findIndex(d => d.id === dep.id)
  if (idx >= 0) all[idx] = dep; else all.unshift(dep)
  await ensureDir()
  await writeJson(deployFile(dep.projectId), all.slice(0, 100))
  return dep
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export function logPath(deployId: string) {
  return path.join(DIR, `log-${deployId}.txt`)
}

export async function appendLog(deployId: string, line: string) {
  await ensureDir()
  await fs.appendFile(logPath(deployId), line + '\n', 'utf8')
}

export async function readLog(deployId: string): Promise<string> {
  try { return await fs.readFile(logPath(deployId), 'utf8') }
  catch { return '' }
}
