import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  ARTEMIS_DATA,
  appendActivity,
  ensureArtemisData,
  knowledgeFileId,
  nowIso,
  safeKnowledgeName,
  type MemoryItem,
} from './store.ts'

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024

export const UPLOAD_FAMILIES = ['pdf', 'docx', 'txt', 'json', 'csv', 'xlsx', 'image', 'code'] as const
export type UploadFamily = (typeof UPLOAD_FAMILIES)[number]

const FAMILY_EXTS: Record<UploadFamily, string[]> = {
  pdf: ['.pdf'],
  docx: ['.docx', '.doc'],
  txt: ['.txt', '.md', '.log'],
  json: ['.json'],
  csv: ['.csv', '.tsv'],
  xlsx: ['.xlsx', '.xls'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'],
  code: [
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.mjs',
    '.cjs',
    '.py',
    '.go',
    '.rs',
    '.java',
    '.rb',
    '.php',
    '.c',
    '.cpp',
    '.h',
    '.cs',
    '.sh',
    '.sql',
    '.yml',
    '.yaml',
    '.toml',
    '.html',
    '.css',
    '.vue',
    '.svelte',
    '.kt',
    '.swift',
  ],
}

const FAMILY_MIMES: Record<UploadFamily, string[]> = {
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  txt: ['text/plain', 'text/markdown'],
  json: ['application/json', 'text/json'],
  csv: ['text/csv', 'text/tab-separated-values'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
  code: ['text/javascript', 'application/javascript', 'text/x-python', 'text/html', 'text/css'],
}

export function extensionOf(name: string): string {
  const base = path.basename(name)
  const dot = base.lastIndexOf('.')
  return dot >= 0 ? base.slice(dot).toLowerCase() : ''
}

export function classifyUpload(name: string, mimeType = ''): UploadFamily | null {
  const ext = extensionOf(name)
  const mime = mimeType.toLowerCase().split(';')[0].trim()
  for (const family of UPLOAD_FAMILIES) {
    if (ext && FAMILY_EXTS[family].includes(ext)) return family
  }
  for (const family of UPLOAD_FAMILIES) {
    if (mime && FAMILY_MIMES[family].includes(mime)) return family
  }
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/')) return 'txt'
  return null
}

export function uploadAcceptAttr(): string {
  return [...new Set(Object.values(FAMILY_EXTS).flat())].join(',')
}

function decodeText(buffer: Buffer): string {
  return buffer.toString('utf8').replaceAll('\0', '')
}

function clip(text: string, max = 16_000): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}\n\n…truncated…`
}

function extractPdfStrings(buffer: Buffer): string {
  const raw = buffer.toString('latin1')
  const chunks: string[] = []
  const re = /\((?:\\.|[^\\)]){5,}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) {
    const value = match[0]
      .slice(1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\[0-9]{1,3}/g, ' ')
    if (/[a-zA-Z]{3,}/.test(value)) chunks.push(value)
    if (chunks.length > 80) break
  }
  return clip(chunks.join('\n'))
}

export function extractUploadText(input: {
  name: string
  mimeType?: string
  buffer: Buffer
}): { family: UploadFamily; text: string; stub: boolean } {
  const family = classifyUpload(input.name, input.mimeType)
  if (!family) {
    throw new Error(`Unsupported file type: ${input.name}`)
  }
  if (family === 'txt' || family === 'code' || family === 'csv') {
    return { family, text: clip(decodeText(input.buffer)), stub: false }
  }
  if (family === 'json') {
    const raw = decodeText(input.buffer)
    try {
      return { family, text: clip(JSON.stringify(JSON.parse(raw), null, 2)), stub: false }
    } catch {
      return { family, text: clip(raw), stub: false }
    }
  }
  if (family === 'pdf') {
    const scraped = extractPdfStrings(input.buffer)
    if (scraped.length > 40) return { family, text: scraped, stub: false }
    return {
      family,
      text: `PDF stored as uploaded/${safeKnowledgeName(input.name)}. Text extraction stub — add a PDF parser for full contents.`,
      stub: true,
    }
  }
  if (family === 'docx') {
    return {
      family,
      text: `DOCX stored as uploaded/${safeKnowledgeName(input.name)}. Parser stub — install a DOCX extractor for full text.`,
      stub: true,
    }
  }
  if (family === 'xlsx') {
    return {
      family,
      text: `Spreadsheet stored as uploaded/${safeKnowledgeName(input.name)}. XLSX parser stub — cells are not expanded yet.`,
      stub: true,
    }
  }
  return {
    family,
    text: `Image ${input.name} (${input.mimeType || 'image'}, ${input.buffer.length} bytes). Vision extraction stub.`,
    stub: true,
  }
}

async function uniqueInDir(dir: string, desired: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true })
  const safe = safeKnowledgeName(desired)
  const ext = path.extname(safe)
  const stem = ext ? safe.slice(0, -ext.length) : safe
  let candidate = safe
  let n = 2
  while (true) {
    try {
      await fs.access(path.join(dir, candidate))
      candidate = `${stem}-${n}${ext}`
      n += 1
    } catch {
      return candidate
    }
  }
}

export type UploadResult = {
  item: MemoryItem
  family: UploadFamily
  stub: boolean
  stored: { original: string; extract: string }
}

export async function ingestArtemisUpload(input: {
  name: string
  mimeType?: string
  buffer: Buffer
  source?: 'bow' | 'quiver'
}): Promise<UploadResult> {
  if (input.buffer.length > UPLOAD_MAX_BYTES) {
    throw new Error(`File exceeds ${UPLOAD_MAX_BYTES / (1024 * 1024)}MB limit`)
  }
  const family = classifyUpload(input.name, input.mimeType)
  if (!family) throw new Error(`Unsupported file type: ${input.name}`)

  await ensureArtemisData()
  await fs.mkdir(path.join(ARTEMIS_DATA, 'uploaded'), { recursive: true })
  const originalName = await uniqueInDir(path.join(ARTEMIS_DATA, 'uploaded'), input.name)
  await fs.writeFile(path.join(ARTEMIS_DATA, 'uploaded', originalName), input.buffer)

  const extracted = extractUploadText({ name: input.name, mimeType: input.mimeType, buffer: input.buffer })
  const extractName = await uniqueInDir(path.join(ARTEMIS_DATA, 'knowledge'), `${originalName}.md`)
  const body = [
    `# ${input.name}`,
    '',
    `Source: uploaded/${originalName}`,
    `Family: ${extracted.family}`,
    `Parser: ${extracted.stub ? 'stub' : 'text'}`,
    input.source ? `Ingest: ${input.source}` : '',
    '',
    extracted.text,
  ]
    .filter(Boolean)
    .join('\n')
  await fs.writeFile(path.join(ARTEMIS_DATA, 'knowledge', extractName), body, 'utf8')
  await appendActivity('upload', `${extracted.family} ${originalName} → knowledge/${extractName}`)

  const item: MemoryItem = {
    id: knowledgeFileId(extractName),
    title: extractName,
    body,
    pinned: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    path: `knowledge/${extractName}`,
    kind: 'files',
  }
  return {
    item,
    family: extracted.family,
    stub: extracted.stub,
    stored: { original: `uploaded/${originalName}`, extract: `knowledge/${extractName}` },
  }
}
