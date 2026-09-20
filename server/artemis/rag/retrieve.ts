import { scoreText, tokenize } from '../store.ts'
import { listKnowledgeIndex, readFileChunks, type KnowledgeIndexEntry } from './indexChunks.ts'
import type { RagChunk } from './chunkText.ts'

export type RetrievedChunk = {
  fileId: string
  name: string
  id: string
  index: number
  text: string
  score: number
}

async function loadCorpus(fileId?: string): Promise<{ entry: KnowledgeIndexEntry; chunks: RagChunk[] }[]> {
  const files = await listKnowledgeIndex()
  const scoped = fileId ? files.filter((entry) => entry.id === fileId) : files
  const rows = []
  for (const entry of scoped) {
    rows.push({ entry, chunks: await readFileChunks(entry.id) })
  }
  return rows
}

/** Score indexed chunks against the query. When fileId is set, retrieval is constrained to that document. */
export async function retrieveRelevantChunks(
  query: string,
  fileId?: string,
  limit = 4,
): Promise<RetrievedChunk[]> {
  const tokens = tokenize(query)
  const corpus = await loadCorpus(fileId)
  const ranked: RetrievedChunk[] = []
  for (const { entry, chunks } of corpus) {
    for (const chunk of chunks) {
      const score = scoreText(`${entry.name}\n${chunk.text}`, tokens)
      ranked.push({
        fileId: entry.id,
        name: entry.name,
        id: chunk.id,
        index: chunk.index,
        text: chunk.text,
        score,
      })
    }
  }
  ranked.sort((a, b) => b.score - a.score || a.index - b.index)
  const hits = ranked.filter((row) => row.score > 0).slice(0, limit)
  if (hits.length) return hits
  if (fileId) return ranked.slice(0, limit)
  return []
}
