import { promises as fs } from 'node:fs'
import path from 'node:path'

const PRINT_GLOBS = [
  'docs/architecture-blueprint.html',
  'docs/ai-application-card-blueprint.html',
  'docs/combined-print.html',
  'docs/cover-sheet.html',
  'docs/cutline-4-week-outreach.html',
  'docs/stripe-authorization-letter.html',
]

const LABELS = {
  'docs/architecture-blueprint.html': 'Architecture blueprint',
  'docs/ai-application-card-blueprint.html': 'AI Application Card blueprint',
  'docs/combined-print.html': 'Combined print pack',
  'docs/cover-sheet.html': 'Cover sheet',
  'docs/cutline-4-week-outreach.html': '4-week outreach plan',
  'docs/stripe-authorization-letter.html': 'Stripe authorization letter',
}

export function resolvePrintablePath(repoRoot, input) {
  const normalized = input.replace(/\\/g, '/')
  if (path.isAbsolute(input)) {
    if (!input.startsWith(repoRoot)) {
      throw new Error('Only files inside the Cutline repo can be printed')
    }
    return path.resolve(input)
  }
  const resolved = path.resolve(repoRoot, normalized)
  if (!resolved.startsWith(repoRoot)) {
    throw new Error('Path escapes repo root')
  }
  return resolved
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function scanDir(dir, ext, out) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await scanDir(full, ext, out)
      else if (entry.name.toLowerCase().endsWith(ext)) out.push(full)
    }
  } catch {
    /* ignore */
  }
}

export async function buildCatalog(repoRoot) {
  const items = []

  for (const rel of PRINT_GLOBS) {
    const abs = path.join(repoRoot, rel)
    if (await exists(abs)) {
      items.push({
        id: rel.replace(/[/\\]/g, '-').replace(/\.[^.]+$/, ''),
        label: LABELS[rel] ?? path.basename(rel),
        path: rel.replace(/\\/g, '/'),
        kind: path.extname(rel).slice(1),
      })
    }
  }

  const businessPdfDir = path.join(repoRoot, 'docs/business')
  const pdfs = []
  await scanDir(businessPdfDir, '.pdf', pdfs)
  for (const abs of pdfs) {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/')
    items.push({
      id: rel.replace(/[/\\]/g, '-').replace(/\.pdf$/, ''),
      label: path.basename(abs, '.pdf').replace(/-/g, ' '),
      path: rel,
      kind: 'pdf',
    })
  }

  return items
}
