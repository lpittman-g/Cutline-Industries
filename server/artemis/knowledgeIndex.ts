/** Compatibility re-exports for the RAG pipeline modules. */
export { chunkText } from './rag/chunkText.ts'
export { extractText } from './rag/extractText.ts'
export { retrieveRelevantChunks } from './rag/retrieve.ts'
export {
  getKnowledgeEntry,
  indexChunks,
  listKnowledgeIndex,
  removeKnowledgeEntry,
  toKnowledgeCard,
  touchKnowledgeEntry,
  KNOWLEDGE_INDEX_FILE,
} from './rag/indexChunks.ts'
