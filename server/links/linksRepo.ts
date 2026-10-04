import { createHash } from 'node:crypto'
import { pool } from '../db/pool.ts'

export type Link = {
  id: string
  slug: string
  destination: string
  title: string
  tags: string[]
  projectId: string | null
  clipId: string | null
  createdBy: number | null
  createdAt: string
  expiresAt: string | null
  archived: boolean
}

export type LinkWithStats = Link & {
  clicks: number
  uniqueCountries: number
  lastClickedAt: string | null
}

export type ClickEvent = {
  country?: string
  city?: string
  device?: string
  browser?: string
  os?: string
  referer?: string
  ip?: string
}

function ipHash(ip: string): string {
  return createHash('sha256').update(ip + process.env.LINK_HASH_SALT || '').digest('hex').slice(0, 16)
}

function row2link(r: Record<string, unknown>): Link {
  return {
    id: r.id as string,
    slug: r.slug as string,
    destination: r.destination as string,
    title: (r.title as string) || '',
    tags: (r.tags as string[]) || [],
    projectId: (r.project_id as string) || null,
    clipId: (r.clip_id as string) || null,
    createdBy: (r.created_by as number) || null,
    createdAt: String(r.created_at),
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    archived: Boolean(r.archived),
  }
}

export async function createLink(input: {
  slug?: string
  destination: string
  title?: string
  tags?: string[]
  projectId?: string
  clipId?: string
  createdBy?: number
  expiresAt?: string
}): Promise<Link> {
  const slug = input.slug || Math.random().toString(36).slice(2, 8)
  const { rows } = await pool.query(
    `INSERT INTO links (slug, destination, title, tags, project_id, clip_id, created_by, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      slug,
      input.destination,
      input.title || '',
      input.tags || [],
      input.projectId || null,
      input.clipId || null,
      input.createdBy || null,
      input.expiresAt || null,
    ],
  )
  return row2link(rows[0])
}

export async function getLink(slug: string): Promise<Link | null> {
  const { rows } = await pool.query('SELECT * FROM links WHERE slug=$1', [slug])
  return rows[0] ? row2link(rows[0]) : null
}

export async function getLinkById(id: string): Promise<Link | null> {
  const { rows } = await pool.query('SELECT * FROM links WHERE id=$1', [id])
  return rows[0] ? row2link(rows[0]) : null
}

export async function listLinks(opts: {
  projectId?: string
  archived?: boolean
  tag?: string
  limit?: number
  offset?: number
} = {}): Promise<LinkWithStats[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let p = 1

  if (opts.projectId !== undefined) { conditions.push(`l.project_id=$${p++}`); params.push(opts.projectId) }
  if (opts.archived !== undefined) { conditions.push(`l.archived=$${p++}`); params.push(opts.archived) }
  else conditions.push('l.archived=false')
  if (opts.tag) { conditions.push(`$${p++}=ANY(l.tags)`); params.push(opts.tag) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(opts.limit ?? 50)
  params.push(opts.offset ?? 0)

  const { rows } = await pool.query(
    `SELECT l.*,
       COUNT(c.id)::int AS clicks,
       COUNT(DISTINCT c.country)::int AS unique_countries,
       MAX(c.clicked_at) AS last_clicked_at
     FROM links l
     LEFT JOIN link_clicks c ON c.link_id=l.id
     ${where}
     GROUP BY l.id
     ORDER BY l.created_at DESC
     LIMIT $${p++} OFFSET $${p++}`,
    params,
  )
  return rows.map((r) => ({
    ...row2link(r),
    clicks: r.clicks as number,
    uniqueCountries: r.unique_countries as number,
    lastClickedAt: r.last_clicked_at ? String(r.last_clicked_at) : null,
  }))
}

export async function updateLink(id: string, patch: Partial<Pick<Link, 'title' | 'tags' | 'destination' | 'expiresAt' | 'archived'>>): Promise<Link | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let p = 1
  if (patch.title !== undefined) { sets.push(`title=$${p++}`); params.push(patch.title) }
  if (patch.tags !== undefined) { sets.push(`tags=$${p++}`); params.push(patch.tags) }
  if (patch.destination !== undefined) { sets.push(`destination=$${p++}`); params.push(patch.destination) }
  if (patch.expiresAt !== undefined) { sets.push(`expires_at=$${p++}`); params.push(patch.expiresAt) }
  if (patch.archived !== undefined) { sets.push(`archived=$${p++}`); params.push(patch.archived) }
  if (!sets.length) return getLinkById(id)
  params.push(id)
  const { rows } = await pool.query(`UPDATE links SET ${sets.join(',')} WHERE id=$${p} RETURNING *`, params)
  return rows[0] ? row2link(rows[0]) : null
}

export async function deleteLink(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM links WHERE id=$1', [id])
  return (rowCount ?? 0) > 0
}

export async function recordClick(linkId: string, event: ClickEvent): Promise<void> {
  await pool.query(
    `INSERT INTO link_clicks (link_id, country, city, device, browser, os, referer, ip_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      linkId,
      event.country || null,
      event.city || null,
      event.device || null,
      event.browser || null,
      event.os || null,
      event.referer ? new URL(event.referer).hostname : null,
      event.ip ? ipHash(event.ip) : null,
    ],
  )
}

export async function getLinkAnalytics(linkId: string, days = 30) {
  const { rows: daily } = await pool.query(
    `SELECT DATE(clicked_at) AS day, COUNT(*)::int AS clicks
     FROM link_clicks
     WHERE link_id=$1 AND clicked_at > NOW() - ($2 || ' days')::interval
     GROUP BY day ORDER BY day`,
    [linkId, days],
  )
  const { rows: countries } = await pool.query(
    `SELECT country, COUNT(*)::int AS clicks FROM link_clicks
     WHERE link_id=$1 AND country IS NOT NULL GROUP BY country ORDER BY clicks DESC LIMIT 10`,
    [linkId],
  )
  const { rows: devices } = await pool.query(
    `SELECT device, COUNT(*)::int AS clicks FROM link_clicks
     WHERE link_id=$1 AND device IS NOT NULL GROUP BY device ORDER BY clicks DESC`,
    [linkId],
  )
  const { rows: referers } = await pool.query(
    `SELECT referer, COUNT(*)::int AS clicks FROM link_clicks
     WHERE link_id=$1 AND referer IS NOT NULL GROUP BY referer ORDER BY clicks DESC LIMIT 10`,
    [linkId],
  )
  return { daily, countries, devices, referers }
}
