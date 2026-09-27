import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { ARTEMIS_DATA } from './store.ts'
import { DRIVE_CATALOG, getDriveStatus, importDriveFile } from './drive.ts'
import { retrieveRelevantChunks } from './rag/retrieve.ts'
import { removeKnowledgeEntry } from './rag/indexChunks.ts'

describe('Google Drive catalog', () => {
  it('lists Cutline Workspace docs without live OAuth', async () => {
    const status = await getDriveStatus()
    assert.equal(status.projectId, process.env.GOOGLE_CLOUD_PROJECT || 'utility-mapper-504300-d6')
    assert.ok(status.files.some((file) => file.title.includes('Lisa')))
    assert.equal(DRIVE_CATALOG.length >= 2, true)
  })

  it('imports a Drive doc through extract → chunk → index', async () => {
    const entry = DRIVE_CATALOG[0]
    let knowledgeId = ''
    let storedOriginal = ''
    let storedExtract = ''
    try {
      const result = await importDriveFile(entry.id)
      knowledgeId = result.index.id
      storedOriginal = result.stored.original
      storedExtract = result.stored.extract
      assert.equal(result.pipeline.extract, true)
      assert.ok(result.pipeline.chunk >= 1)
      assert.equal(result.index.indexed, true)
      assert.match(result.index.name, /Lisa/)
      const hits = await retrieveRelevantChunks('Azure AI Foundry Lisa privacy', knowledgeId)
      assert.ok(hits.some((hit) => /Lisa|Azure/i.test(hit.text)))
    } finally {
      if (knowledgeId) await removeKnowledgeEntry(knowledgeId)
      if (storedOriginal) await fs.rm(path.join(ARTEMIS_DATA, storedOriginal), { force: true })
      if (storedExtract) await fs.rm(path.join(ARTEMIS_DATA, storedExtract), { force: true })
    }
  })
})
