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
import { classifyUpload, extractText, uploadAcceptAttr, UPLOAD_FAMILIES, type UploadFamily } from './rag/extractText.ts'
import { chunkText } from './rag/chunkText.ts'
import { indexChunks, toKnowledgeCard } from './rag/indexChunks.ts'

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024
export { classifyUpload, extractText, uploadAcceptAttr, UPLOAD_FAMILIES, type UploadFamily }

export function extractUploadText(input: { name: string; mimeType?: string; buffer: Buffer }) {
  return extractText(input)
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
  index: ReturnType<typeof toKnowledgeCard>
  pipeline: { extract: boolean; chunk: number; index: boolean }
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

  const extracted = extractText({ name: input.name, mimeType: input.mimeType, buffer: input.buffer })
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

  const fileId = knowledgeFileId(extractName)
  const chunks = chunkText(extracted.text, fileId)
  const indexed = await indexChunks(fileId, chunks, {
    name: input.name,
    extract: `knowledge/${extractName}`,
    original: `uploaded/${originalName}`,
    family: extracted.family,
    stub: extracted.stub,
  })
  await appendActivity(
    'upload',
    `${extracted.family} ${originalName} → knowledge/${extractName} (${indexed.chunkCount} chunks)`,
  )

  const item: MemoryItem = {
    id: fileId,
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
    index: toKnowledgeCard(indexed),
    pipeline: { extract: true, chunk: chunks.length, index: indexed.indexed },
  }
}
