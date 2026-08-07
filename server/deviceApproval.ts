import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ROOT } from './youtubeAuth.ts'

const PENDING_DIR = path.join(ROOT, 'secrets', 'approval-pending')
const DEVICES_PATH = path.join(ROOT, 'secrets', 'approval-devices.json')
const TOPIC_PATH = path.join(ROOT, 'secrets', 'approval-topic.txt')

export type ApprovalRecord = {
  id: string
  service: string
  detail: string
  desktopUrl: string | null
  status: 'pending' | 'approved' | 'denied' | 'timeout'
  createdAt: string
  decidedAt: string | null
}

export type PairedDevice = {
  deviceId: string
  label: string
  pairedAt: string
  lastSeenAt: string
  /** Never store serial numbers — use generated device ID only */
  userAgent?: string
}

async function ensureDirs() {
  await fs.mkdir(PENDING_DIR, { recursive: true, mode: 0o700 })
}

function pendingPath(id: string) {
  return path.join(PENDING_DIR, `${id}.json`)
}

export async function writePending(rec: ApprovalRecord) {
  await ensureDirs()
  await fs.writeFile(pendingPath(rec.id), JSON.stringify(rec, null, 2), { mode: 0o600 })
}

export async function readPending(id: string): Promise<ApprovalRecord | null> {
  try {
    return JSON.parse(await fs.readFile(pendingPath(id), 'utf8')) as ApprovalRecord
  } catch {
    return null
  }
}

export async function resolvePending(id: string, decision: 'approved' | 'denied') {
  const cur = await readPending(id)
  if (!cur) return null
  cur.status = decision
  cur.decidedAt = new Date().toISOString()
  await writePending(cur)
  return cur
}

export async function loadDevices(): Promise<PairedDevice[]> {
  try {
    return JSON.parse(await fs.readFile(DEVICES_PATH, 'utf8')) as PairedDevice[]
  } catch {
    return []
  }
}

export async function saveDevices(devices: PairedDevice[]) {
  await fs.mkdir(path.dirname(DEVICES_PATH), { recursive: true, mode: 0o700 })
  await fs.writeFile(DEVICES_PATH, JSON.stringify(devices.slice(-20), null, 2), { mode: 0o600 })
}

export async function registerDevice(input: {
  deviceId: string
  label: string
  userAgent?: string
}): Promise<PairedDevice> {
  const devices = await loadDevices()
  const now = new Date().toISOString()
  const existing = devices.find((d) => d.deviceId === input.deviceId)
  const row: PairedDevice = {
    deviceId: input.deviceId,
    label: input.label.slice(0, 80) || 'My iPhone',
    pairedAt: existing?.pairedAt ?? now,
    lastSeenAt: now,
    userAgent: input.userAgent?.slice(0, 200),
  }
  const next = [row, ...devices.filter((d) => d.deviceId !== input.deviceId)]
  await saveDevices(next)
  return row
}

export function defaultNtfyTopic(): string {
  const configuredTopic = process.env.CUTLINE_NTFY_TOPIC?.trim()
  if (configuredTopic) return configuredTopic

  const legacyTopic = process.env.CUTLINE_APPROVAL_PAIR_SECRET?.trim()
  if (legacyTopic?.startsWith('cutline-')) return legacyTopic

  if (existsSync(TOPIC_PATH)) {
    const savedTopic = readFileSync(TOPIC_PATH, 'utf8').trim()
    if (savedTopic) return savedTopic
  }

  const topic = `cutline-thermal-${randomUUID().replace(/-/g, '').slice(0, 12)}`
  mkdirSync(path.dirname(TOPIC_PATH), { recursive: true, mode: 0o700 })
  writeFileSync(TOPIC_PATH, `${topic}\n`, { mode: 0o600 })
  return topic
}

export function approvalPageUrl(approvalId: string): string {
  const base = process.env.CUTLINE_PUBLIC_URL || 'https://cutline-industries.studio'
  return `${base.replace(/\/$/, '')}/approve?id=${approvalId}`
}

export async function notifyViaNtfy(opts: {
  title: string
  body: string
  approvalId: string
  service: string
  desktopUrl?: string | null
}) {
  const topic = process.env.CUTLINE_NTFY_TOPIC || defaultNtfyTopic()
  const server = (process.env.CUTLINE_NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '')
  const click = approvalPageUrl(opts.approvalId)

  const headers: Record<string, string> = {
    Title: opts.title.slice(0, 250),
    Priority: 'urgent',
    Tags: 'warning,agent',
    Click: click,
  }
  if (opts.desktopUrl) headers['Actions'] = `view, Open desktop, ${opts.desktopUrl}`

  const res = await fetch(`${server}/${topic}`, {
    method: 'POST',
    headers,
    body: `${opts.body}\n\nTap to Approve or Deny → ${click}`,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`ntfy error ${res.status}: ${text}`)
  }

  return { ok: true, topic, click, server }
}

export async function createApprovalRequest(opts: {
  service: string
  detail?: string
  desktopUrl?: string | null
}) {
  const id = randomUUID()
  const rec: ApprovalRecord = {
    id,
    service: opts.service,
    detail: opts.detail || '',
    desktopUrl: opts.desktopUrl ?? null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null,
  }
  await writePending(rec)
  return rec
}

export async function waitForApproval(id: string, waitSeconds: number) {
  const deadline = Date.now() + waitSeconds * 1000
  while (Date.now() < deadline) {
    const cur = await readPending(id)
    if (cur && cur.status !== 'pending') return cur
    await new Promise((r) => setTimeout(r, 1500))
  }
  return readPending(id)
}

export function approvalStatus() {
  const topic = process.env.CUTLINE_NTFY_TOPIC || defaultNtfyTopic()
  const hasPairSecret = Boolean(process.env.CUTLINE_APPROVAL_PAIR_SECRET)
  const hasTopicOverride = Boolean(process.env.CUTLINE_NTFY_TOPIC?.trim())
  return {
    mode: 'cutline-device-approval-lite',
    usesAppleDeveloper: false,
    usesSerialNumber: false,
    deviceIdentity: 'Generated device ID in browser localStorage (not Apple serial)',
    ntfyTopic: topic,
    ntfyServer: process.env.CUTLINE_NTFY_SERVER || 'https://ntfy.sh',
    hasPairSecret,
    hasTopicOverride,
    approvePage: approvalPageUrl('{approvalId}'),
    setupDoc: 'tools/phone-approval-lite/docs/SETUP-NO-APPLE-DEV.md',
    iosApp: 'Install ntfy from App Store → subscribe to topic above',
  }
}
