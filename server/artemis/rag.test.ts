import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { ARTEMIS_DATA } from './store.ts'
import { chunkText } from './rag/chunkText.ts'
import { extractText } from './rag/extractText.ts'
import { getKnowledgeEntry, indexChunks, removeKnowledgeEntry } from './rag/indexChunks.ts'
import { retrieveRelevantChunks } from './rag/retrieve.ts'

describe('extractText', () => {
  it('extracts json and stubs pdf', () => {
    const json = extractText({ name: 'cfg.json', buffer: Buffer.from('{"voice":"astra"}') })
    assert.equal(json.family, 'json')
    assert.equal(json.stub, false)
    assert.match(json.text, /astra/)
    const pdf = extractText({ name: 'deck.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
    assert.equal(pdf.family, 'pdf')
    assert.equal(pdf.stub, true)
  })
})

describe('chunkText', () => {
  it('splits long text into overlapping chunks', () => {
    const chunks = chunkText('alpha '.repeat(120), 'file_demo')
    assert.ok(chunks.length >= 2)
    assert.equal(chunks[0].id, 'file_demo_c1')
    assert.ok(chunks[0].text.includes('alpha'))
    assert.equal(chunks[1].index, 1)
  })
})

describe('indexChunks + retrieveRelevantChunks', () => {
  it('stores metadata and retrieves by query, constrained to fileId', async () => {
    const fileId = 'file_rag_pipeline_test'
    const otherId = 'file_rag_other_test'
    try {
      const chunks = chunkText(
        'Thermal clips convert live-stream heat into Shorts. Artemis indexes this briefing for retrieval.',
        fileId,
      )
      const entry = await indexChunks(fileId, chunks, {
        name: 'Artemis Architecture.pdf',
        extract: 'knowledge/Artemis-Architecture.pdf.md',
        original: 'uploaded/Artemis-Architecture.pdf',
        family: 'pdf',
        stub: true,
      })
      assert.equal(entry.name, 'Artemis Architecture.pdf')
      assert.equal(entry.indexed, true)
      assert.ok(entry.chunkCount >= 1)
      assert.ok(entry.lastUsedAt)
      await indexChunks(otherId, chunkText('Unrelated potatoes and weather notes.', otherId), {
        name: 'other.txt',
        extract: 'knowledge/other.txt.md',
        original: 'uploaded/other.txt',
        family: 'txt',
      })
      const stored = await getKnowledgeEntry(fileId)
      assert.equal(stored?.indexed, true)
      const hits = await retrieveRelevantChunks('indexes this briefing', fileId)
      assert.ok(hits.length >= 1)
      assert.ok(hits.every((hit) => hit.fileId === fileId))
      assert.match(hits[0].text, /briefing|Thermal|Artemis/i)
      const unconstrained = await retrieveRelevantChunks('potatoes')
      assert.ok(unconstrained.some((hit) => hit.fileId === otherId))
      const scopedMiss = await retrieveRelevantChunks('potatoes', fileId)
      assert.ok(scopedMiss.every((hit) => hit.fileId === fileId))
    } finally {
      await removeKnowledgeEntry(fileId)
      await removeKnowledgeEntry(otherId)
      await fs.rm(path.join(ARTEMIS_DATA, 'rag', `${fileId}.json`), { force: true })
      await fs.rm(path.join(ARTEMIS_DATA, 'rag', `${otherId}.json`), { force: true })
    }
  })
})
