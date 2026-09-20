import path from 'node:path'
import { safeKnowledgeName } from '../store.ts'

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
  const parts: string[] = []
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
    if (/[a-zA-Z]{3,}/.test(value)) parts.push(value)
    if (parts.length > 80) break
  }
  return clip(parts.join('\n'))
}

/** Extract text from an uploaded file. Heavy parsers (PDF/DOCX/XLSX/vision) are stubbed. */
export function extractText(file: { name: string; mimeType?: string; buffer: Buffer }): {
  family: UploadFamily
  text: string
  stub: boolean
} {
  const family = classifyUpload(file.name, file.mimeType)
  if (!family) throw new Error(`Unsupported file type: ${file.name}`)
  if (family === 'txt' || family === 'code' || family === 'csv') {
    return { family, text: clip(decodeText(file.buffer)), stub: false }
  }
  if (family === 'json') {
    const raw = decodeText(file.buffer)
    try {
      return { family, text: clip(JSON.stringify(JSON.parse(raw), null, 2)), stub: false }
    } catch {
      return { family, text: clip(raw), stub: false }
    }
  }
  if (family === 'pdf') {
    const scraped = extractPdfStrings(file.buffer)
    if (scraped.length > 40) return { family, text: scraped, stub: false }
    return {
      family,
      text: `PDF stored as uploaded/${safeKnowledgeName(file.name)}. Text extraction stub — add a PDF parser for full contents.`,
      stub: true,
    }
  }
  if (family === 'docx') {
    return {
      family,
      text: `DOCX stored as uploaded/${safeKnowledgeName(file.name)}. Parser stub — install a DOCX extractor for full text.`,
      stub: true,
    }
  }
  if (family === 'xlsx') {
    return {
      family,
      text: `Spreadsheet stored as uploaded/${safeKnowledgeName(file.name)}. XLSX parser stub — cells are not expanded yet.`,
      stub: true,
    }
  }
  return {
    family,
    text: `Image ${file.name} (${file.mimeType || 'image'}, ${file.buffer.length} bytes). Vision extraction stub.`,
    stub: true,
  }
}
