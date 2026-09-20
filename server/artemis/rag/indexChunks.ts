import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ARTEMIS_DATA, ensureArtemisData, nowIso } from '../store.ts'
import type { RagChunk } from './chunkText.ts'

export const KNOWLEDGE_INDEX_FILE = path.join(ARTEMIS_DATA, 'knowledge-index.json')
export const RAG_DIR = path.join(ARTEMIS_DATA, 'rag')

export type KnowledgeIndexEntry = {
  id: string
  name: string
  filename: string
  extract: string
  original: string
  family: string
  indexed: boolean
  status: 'indexed'
  chunkCount: number
  stub: boolean
  indexedAt: string
  lastUsedAt: string
}

type IndexFile = { files: Record<string, KnowledgeIndexEntry> }

type ChunkStore = { fileId: string; chunks: RagChunk[] }

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

export async function readFileChunks(fileId: string): Promise<RagChunk[]> {
  try {
    const stored = JSON.parse(await fs.readFile(path.join(RAG_DIR, `${fileId}.json`), 'utf8')) as ChunkStore
    return stored.chunks ?? []
  } catch {
    return []
  }
}

export async function listKnowledgeIndex(): Promise<KnowledgeIndexEntry[]> {
  const index = await readIndex()
  return Object.values(index.files).sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeIndexEntry | null> {
  const index = await readIndex()
  return index.files[id] ?? null
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
  await fs.rm(path.join(RAG_DIR, `${id}.json`), { force: true })
  return true
}

export function toKnowledgeCard(entry: KnowledgeIndexEntry) {
  return {
    id: entry.id,
    name: entry.name,
    filename: entry.filename || entry.name,
    extract: entry.extract,
    original: entry.original,
    indexed: entry.indexed,
    status: 'indexed' as const,
    chunkCount: entry.chunkCount,
    stub: entry.stub,
    indexedAt: entry.indexedAt,
    lastUsedAt: entry.lastUsedAt,
  }
}

/** Persist chunks + file-card metadata (name, indexed, chunkCount, lastUsedAt). */
export async function indexChunks(
  fileId: string,
  chunks: RagChunk[],
  meta: {
    name: string
    extract: string
    original: string
    family: string
    stub?: boolean
  },
): Promise<KnowledgeIndexEntry> {
  await ensureArtemisData()
  await fs.mkdir(RAG_DIR, { recursive: true })
  const payload: ChunkStore = { fileId, chunks }
  await fs.writeFile(path.join(RAG_DIR, `${fileId}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  const at = nowIso()
  const entry: KnowledgeIndexEntry = {
    id: fileId,
    name: meta.name,
    filename: meta.name,
    extract: meta.extract,
    original: meta.original,
    family: meta.family,
    indexed: true,
    status: 'indexed',
    chunkCount: chunks.length,
    stub: Boolean(meta.stub),
    indexedAt: at,
    lastUsedAt: at,
  }
  const index = await readIndex()
  index.files[fileId] = entry
  await writeIndex(index)
  return entry
}
