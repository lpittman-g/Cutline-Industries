export const CHUNK_SIZE = 420
export const CHUNK_OVERLAP = 60

export type RagChunk = {
  id: string
  index: number
  text: string
}

/** Split extracted text into overlapping retrieval chunks. */
export function chunkText(text: string, fileId = 'doc'): RagChunk[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  const source = clean || 'Empty extract'
  const chunks: RagChunk[] = []
  let start = 0
  while (start < source.length) {
    const end = Math.min(source.length, start + CHUNK_SIZE)
    const slice = source.slice(start, end).trim()
    if (slice) {
      chunks.push({
        id: `${fileId}_c${chunks.length + 1}`,
        index: chunks.length,
        text: slice,
      })
    }
    if (end >= source.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }
  return chunks.length ? chunks : [{ id: `${fileId}_c1`, index: 0, text: source }]
}
