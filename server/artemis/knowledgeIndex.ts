import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ARTEMIS_DATA, ensureArtemisData, nowIso } from './store.ts'

export const KNOWLEDGE_INDEX_FILE = path.join(ARTEMIS_DATA, 'knowledge-index.json')

export type KnowledgeChunk = {
  id: string
  preview: string
}

export type KnowledgeIndexEntry = {
  id: string
  filename: string
  extract: string
  original: string
  family: string
  status: 'indexed'
  chunkCount: number
  stub: boolean
  indexedAt: string
  lastUsedAt: string
  chunks: KnowledgeChunk[]
}

type IndexFile = { files: Record<string, KnowledgeIndexEntry> }

export function stubChunkDocument(input: { text: string; bytes: number; stubParser: boolean }): {
  chunkCount: number
  chunks: KnowledgeChunk[]
  stub: boolean
} {
  if (input.stubParser) {
    const chunkCount = Math.max(12, Math.min(96, Math.round(input.bytes / 800) || 24))
    return {
      chunkCount,
      chunks: Array.from({ length: Math.min(8, chunkCount) }, (_, i) => ({
        id: `chunk_${i + 1}`,
        preview: `Stub chunk ${i + 1}`,
      })),
      stub: true,
    }
  }
  const size = 280
  const text = input.text.trim() || 'indexed'
  const chunks: KnowledgeChunk[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push({
      id: `chunk_${chunks.length + 1}`,
      preview: text.slice(i, i + 96),
    })
  }
  return {
    chunkCount: Math.max(1, chunks.length),
    chunks: chunks.slice(0, 8),
    stub: false,
  }
}

async function readIndex(): Promise<IndexFile> {
  try {
    return JSON.parse(await fs.readFile(KNOWLEDGE_INDEX_FILE, 'utf8')) as IndexFile
  } catch {
    return { files: {} }
  }
}

async function writeIndex(value: IndexFile) {
  await ensureArtemisData()
  await fs.writeFile(KNOWLEDGE_INDEX_FILE, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function listKnowledgeIndex(): Promise<KnowledgeIndexEntry[]> {
  const index = await readIndex()
  return Object.values(index.files).sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeIndexEntry | null> {
  const index = await readIndex()
  return index.files[id] ?? null
}

export async function upsertKnowledgeEntry(
  entry: Omit<KnowledgeIndexEntry, 'indexedAt' | 'lastUsedAt' | 'status'> & {
    indexedAt?: string
    lastUsedAt?: string
  },
): Promise<KnowledgeIndexEntry> {
  const at = nowIso()
  const stored: KnowledgeIndexEntry = {
    ...entry,
    status: 'indexed',
    indexedAt: entry.indexedAt ?? at,
    lastUsedAt: entry.lastUsedAt ?? at,
  }
  const index = await readIndex()
  index.files[stored.id] = stored
  await writeIndex(index)
  return stored
}

export async function touchKnowledgeEntry(id: string): Promise<KnowledgeIndexEntry | null> {
  const index = await readIndex()
  const current = index.files[id]
  if (!current) return null
  current.lastUsedAt = nowIso()
  index.files[id] = current
  await writeIndex(index)
  return current
}

export async function removeKnowledgeEntry(id: string): Promise<boolean> {
  const index = await readIndex()
  if (!index.files[id]) return false
  delete index.files[id]
  await writeIndex(index)
  return true
}

export function toKnowledgeCard(entry: KnowledgeIndexEntry) {
  return {
    id: entry.id,
    filename: entry.filename,
    extract: entry.extract,
    original: entry.original,
    status: entry.status,
    chunkCount: entry.chunkCount,
    stub: entry.stub,
    indexedAt: entry.indexedAt,
    lastUsedAt: entry.lastUsedAt,
  }
}
