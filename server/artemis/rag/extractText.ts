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
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.rb', '.php',
    '.c', '.cpp', '.h', '.cs', '.sh', '.sql',
    '.yml', '.yaml', '.toml', '.html', '.css',
    '.vue', '.svelte', '.kt', '.swift',
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

/** Extract text from an uploaded file. PDF, DOCX, XLSX use real parsers. */
export async function extractText(file: { name: string; mimeType?: string; buffer: Buffer }): Promise<{
  family: UploadFamily
  text: string
  stub: boolean
}> {
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
    try {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(file.buffer)
      const text = result.text?.trim()
      if (text && text.length > 40) {
        return { family, text: clip(text), stub: false }
      }
    } catch {
      // fall through to stored-file notice
    }
    return {
      family,
      text: `PDF stored as uploaded/${safeKnowledgeName(file.name)}. No extractable text found (scanned or image-based PDF).`,
      stub: true,
    }
  }

  if (family === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: file.buffer })
      const text = result.value?.trim()
      if (text && text.length > 10) {
        return { family, text: clip(text), stub: false }
      }
    } catch {
      // fall through
    }
    return {
      family,
      text: `DOCX stored as uploaded/${safeKnowledgeName(file.name)}. Text extraction failed — file may be corrupted or password-protected.`,
      stub: true,
    }
  }

  if (family === 'xlsx') {
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const parts: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
        if (csv.trim()) parts.push(`## Sheet: ${sheetName}\n${csv}`)
      }
      const text = parts.join('\n\n').trim()
      if (text.length > 10) {
        return { family, text: clip(text), stub: false }
      }
    } catch {
      // fall through
    }
    return {
      family,
      text: `Spreadsheet stored as uploaded/${safeKnowledgeName(file.name)}. Could not extract cell data.`,
      stub: true,
    }
  }

  // image — no vision API
  return {
    family,
    text: `Image: ${file.name} (${file.mimeType || 'image'}, ${(file.buffer.length / 1024).toFixed(1)}KB). Stored as uploaded/${safeKnowledgeName(file.name)}.`,
    stub: true,
  }
}
