/**
 * Cutline Platform deploy API — all routes mount at /api/deploy
 * Replaces GitHub Actions + Vercel entirely. Runs inside the Artemis network.
 */
import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import {
  getProjects, getProject, saveProject, deleteProject,
  getDeployments, getDeployment, saveDeployment, readLog,
  type Project, type Deployment, type ProjectEnv,
} from './store.ts'
import { executeDeploy, buildBus } from './runner.ts'

export function registerDeployRoutes(app: ReturnType<typeof import('express').default>) {
  const r = Router()

  // ── Projects ──────────────────────────────────────────────────────────────

  r.get('/projects', async (_req, res) => {
    const projects = await getProjects()
    // attach latest deployment status to each
    const withStatus = await Promise.all(projects.map(async p => {
      const deps = await getDeployments(p.id)
      return { ...p, latestDeploy: deps[0] ?? null }
    }))
    res.json({ projects: withStatus })
  })

  r.post('/projects', async (req: Request, res: Response) => {
    const { name, description = '', domain = '', buildCmd = 'npm run build', outputDir = 'dist', rootDir = '' } = req.body as Partial<Project & { name: string }>
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    const project: Project = {
      id: randomUUID(),
      name, description, domain, buildCmd, outputDir,
      rootDir: rootDir || process.cwd(),
      envVars: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await saveProject(project)
    res.status(201).json({ project })
  })

  r.get('/projects/:id', async (req, res) => {
    const p = await getProject(req.params.id)
    if (!p) { res.status(404).json({ error: 'not found' }); return }
    res.json({ project: p })
  })

  r.patch('/projects/:id', async (req, res) => {
    const p = await getProject(req.params.id)
    if (!p) { res.status(404).json({ error: 'not found' }); return }
    const updated = { ...p, ...req.body as Partial<Project>, id: p.id, updatedAt: new Date().toISOString() }
    await saveProject(updated)
    res.json({ project: updated })
  })

  r.delete('/projects/:id', async (req, res) => {
    const ok = await deleteProject(req.params.id)
    res.json({ ok })
  })

  // ── Environment variables ─────────────────────────────────────────────────

  r.get('/projects/:id/env', async (req, res) => {
    const p = await getProject(req.params.id)
    if (!p) { res.status(404).json({ error: 'not found' }); return }
    // mask values for non-local requests
    const masked = p.envVars.map(e => ({ ...e, value: e.value ? '••••' : '' }))
    res.json({ env: masked })
  })

  r.put('/projects/:id/env', async (req, res) => {
    const p = await getProject(req.params.id)
    if (!p) { res.status(404).json({ error: 'not found' }); return }
    const { vars } = req.body as { vars: ProjectEnv[] }
    p.envVars = vars ?? []
    p.updatedAt = new Date().toISOString()
    await saveProject(p)
    res.json({ ok: true, count: p.envVars.length })
  })

  r.post('/projects/:id/env', async (req, res) => {
    const p = await getProject(req.params.id)
    if (!p) { res.status(404).json({ error: 'not found' }); return }
    const v = req.body as ProjectEnv
    if (!v.key) { res.status(400).json({ error: 'key required' }); return }
    const idx = p.envVars.findIndex(e => e.key === v.key && e.target === v.target)
    if (idx >= 0) p.envVars[idx] = v; else p.envVars.push(v)
    p.updatedAt = new Date().toISOString()
    await saveProject(p)
    res.json({ ok: true })
  })

  r.delete('/projects/:id/env/:key', async (req, res) => {
    const p = await getProject(req.params.id)
    if (!p) { res.status(404).json({ error: 'not found' }); return }
    p.envVars = p.envVars.filter(e => e.key !== req.params.key)
    p.updatedAt = new Date().toISOString()
    await saveProject(p)
    res.json({ ok: true })
  })

  // ── Deployments ───────────────────────────────────────────────────────────

  r.get('/projects/:id/deployments', async (req, res) => {
    const deps = await getDeployments(req.params.id)
    res.json({ deployments: deps })
  })

  r.post('/projects/:id/deploy', async (req, res) => {
    const project = await getProject(req.params.id)
    if (!project) { res.status(404).json({ error: 'not found' }); return }

    const { trigger = 'manual', message = 'Manual deploy', sha = 'HEAD', author = 'platform', branch = 'main' } = req.body as Partial<Deployment>
    const dep: Deployment = {
      id: randomUUID(),
      projectId: project.id,
      status: 'queued',
      trigger, message, sha, author, branch,
      duration: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logFile: '',
    }
    await saveDeployment(dep)

    // fire-and-forget
    setImmediate(() => executeDeploy(project, dep))

    res.status(202).json({ deployment: dep })
  })

  r.get('/projects/:id/deployments/:depId', async (req, res) => {
    const dep = await getDeployment(req.params.id, req.params.depId)
    if (!dep) { res.status(404).json({ error: 'not found' }); return }
    res.json({ deployment: dep })
  })

  r.delete('/projects/:id/deployments/:depId', async (req, res) => {
    const dep = await getDeployment(req.params.id, req.params.depId)
    if (!dep) { res.status(404).json({ error: 'not found' }); return }
    dep.status = 'cancelled'
    dep.finishedAt = new Date().toISOString()
    await saveDeployment(dep)
    res.json({ ok: true })
  })

  // ── Log streaming (SSE) ───────────────────────────────────────────────────

  r.get('/projects/:id/deployments/:depId/logs', async (req, res) => {
    const dep = await getDeployment(req.params.id, req.params.depId)
    if (!dep) { res.status(404).json({ error: 'not found' }); return }

    // Return full log for finished deployments
    if (dep.status === 'ready' || dep.status === 'error' || dep.status === 'cancelled') {
      const log = await readLog(dep.id)
      res.setHeader('Content-Type', 'text/plain')
      res.send(log)
      return
    }

    // SSE stream for in-progress builds
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // replay existing log lines
    const existing = await readLog(dep.id)
    if (existing) {
      for (const line of existing.split('\n')) {
        if (line) res.write(`data: ${line}\n\n`)
      }
    }

    const onLog = (line: string) => res.write(`data: ${line}\n\n`)
    const onDone = (status: string) => {
      res.write(`data: [DONE:${status}]\n\n`)
      res.end()
    }

    buildBus.on(`log:${dep.id}`, onLog)
    buildBus.once(`done:${dep.id}`, onDone)

    req.on('close', () => {
      buildBus.off(`log:${dep.id}`, onLog)
      buildBus.off(`done:${dep.id}`, onDone)
    })
  })

  // ── Webhook receiver (replaces GitHub webhook) ────────────────────────────

  r.post('/webhook/:projectId', async (req, res) => {
    const project = await getProject(req.params.projectId)
    if (!project) { res.status(404).json({ error: 'not found' }); return }

    const { ref = 'refs/heads/main', head_commit } = req.body as {
      ref?: string
      head_commit?: { id?: string; message?: string; author?: { name?: string } }
    }
    const branch = ref.replace('refs/heads/', '')
    const dep: Deployment = {
      id: randomUUID(),
      projectId: project.id,
      status: 'queued',
      trigger: 'webhook',
      message: head_commit?.message?.split('\n')[0] ?? 'Webhook push',
      sha: (head_commit?.id ?? randomUUID()).slice(0, 7),
      author: head_commit?.author?.name ?? 'webhook',
      branch,
      duration: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logFile: '',
    }
    await saveDeployment(dep)
    setImmediate(() => executeDeploy(project, dep))
    res.status(202).json({ deployment: dep })
  })

  // ── Platform status ───────────────────────────────────────────────────────

  r.get('/status', async (_req, res) => {
    const projects = await getProjects()
    const counts = await Promise.all(projects.map(async p => {
      const deps = await getDeployments(p.id)
      const latest = deps[0]
      return { id: p.id, name: p.name, status: latest?.status ?? 'none', deployCount: deps.length }
    }))
    res.json({
      platform: 'Cutline Platform',
      network: 'Artemis',
      projectCount: projects.length,
      projects: counts,
    })
  })

  app.use('/api/deploy', r)
}
