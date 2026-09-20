import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { ARTEMIS_DATA, loadRelevantMemory } from './store.ts'
import { getKnowledgeEntry, stubChunkDocument, touchKnowledgeEntry } from './knowledgeIndex.ts'
import {
  classifyUpload,
  extractUploadText,
  ingestArtemisUpload,
  uploadAcceptAttr,
  UPLOAD_FAMILIES,
} from './upload.ts'

describe('classifyUpload', () => {
  it('maps extensions and MIME families', () => {
    assert.equal(classifyUpload('brief.pdf'), 'pdf')
    assert.equal(classifyUpload('notes.docx'), 'docx')
    assert.equal(classifyUpload('readme.txt'), 'txt')
    assert.equal(classifyUpload('payload.json'), 'json')
    assert.equal(classifyUpload('rows.csv'), 'csv')
    assert.equal(classifyUpload('book.xlsx'), 'xlsx')
    assert.equal(classifyUpload('shot.png'), 'image')
    assert.equal(classifyUpload('handler.ts'), 'code')
    assert.equal(classifyUpload('untitled', 'image/webp'), 'image')
    assert.equal(classifyUpload('untitled', 'text/plain'), 'txt')
    assert.equal(classifyUpload('drop.exe'), null)
    assert.deepEqual([...UPLOAD_FAMILIES], ['pdf', 'docx', 'txt', 'json', 'csv', 'xlsx', 'image', 'code'])
    assert.match(uploadAcceptAttr(), /\.pdf/)
    assert.match(uploadAcceptAttr(), /\.xlsx/)
  })
})

describe('extractUploadText', () => {
  it('extracts text, json, csv, and code; stubs binary families', () => {
    const txt = extractUploadText({ name: 'note.txt', buffer: Buffer.from('Hello Artemis memory') })
    assert.equal(txt.family, 'txt')
    assert.equal(txt.stub, false)
    assert.match(txt.text, /Hello Artemis memory/)

    const json = extractUploadText({ name: 'cfg.json', buffer: Buffer.from('{"voice":"astra"}') })
    assert.equal(json.family, 'json')
    assert.match(json.text, /astra/)

    const csv = extractUploadText({ name: 'rows.csv', buffer: Buffer.from('a,b\n1,2') })
    assert.equal(csv.family, 'csv')
    assert.equal(csv.stub, false)

    const code = extractUploadText({ name: 'app.ts', buffer: Buffer.from('export const voice = "astra"\n') })
    assert.equal(code.family, 'code')
    assert.match(code.text, /astra/)

    const pdf = extractUploadText({ name: 'empty.pdf', buffer: Buffer.from('%PDF-1.4 binary') })
    assert.equal(pdf.family, 'pdf')
    assert.equal(pdf.stub, true)

    const docx = extractUploadText({ name: 'memo.docx', buffer: Buffer.from('PK') })
    assert.equal(docx.family, 'docx')
    assert.equal(docx.stub, true)

    const xlsx = extractUploadText({ name: 'grid.xlsx', buffer: Buffer.from('PK') })
    assert.equal(xlsx.family, 'xlsx')
    assert.equal(xlsx.stub, true)

    const image = extractUploadText({ name: 'shot.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50]) })
    assert.equal(image.family, 'image')
    assert.equal(image.stub, true)
  })
})

describe('stubChunkDocument', () => {
  it('counts text chunks and fakes stub-parser counts', () => {
    const text = stubChunkDocument({ text: 'a'.repeat(600), bytes: 600, stubParser: false })
    assert.equal(text.stub, false)
    assert.equal(text.chunkCount, 3)
    const fake = stubChunkDocument({ text: 'PDF stub', bytes: 24_000, stubParser: true })
    assert.equal(fake.stub, true)
    assert.equal(fake.chunkCount, 30)
  })
})

describe('ingestArtemisUpload', () => {
  it('stores original + knowledge extract and scores in the memory loop', async () => {
    const activity = path.join(ARTEMIS_DATA, 'logs', 'activity.jsonl')
    const indexFile = path.join(ARTEMIS_DATA, 'knowledge-index.json')
    const before = await fs.readFile(activity, 'utf8').catch(() => '')
    const beforeIndex = await fs.readFile(indexFile, 'utf8').catch(() => '')
    let storedOriginal = ''
    let storedExtract = ''
    let knowledgeId = ''
    try {
      const result = await ingestArtemisUpload({
        name: 'upload-loop-test.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ topic: 'quiver-ingest-token', voice: 'astra' })),
        source: 'bow',
      })
      storedOriginal = result.stored.original
      storedExtract = result.stored.extract
      knowledgeId = result.index.id
      assert.equal(result.family, 'json')
      assert.equal(result.stub, false)
      assert.equal(result.item.kind, 'files')
      assert.equal(result.index.status, 'indexed')
      assert.equal(result.index.filename, 'upload-loop-test.json')
      assert.ok(result.index.chunkCount >= 1)
      assert.match(result.stored.original, /^uploaded\/upload-loop-test/)
      assert.match(result.stored.extract, /^knowledge\/upload-loop-test/)
      const original = await fs.readFile(path.join(ARTEMIS_DATA, storedOriginal), 'utf8')
      assert.match(original, /quiver-ingest-token/)
      const extract = await fs.readFile(path.join(ARTEMIS_DATA, storedExtract), 'utf8')
      assert.match(extract, /quiver-ingest-token/)
      const lines = await fs.readFile(activity, 'utf8')
      assert.match(lines, /upload-loop-test/)
      const indexed = await getKnowledgeEntry(knowledgeId)
      assert.ok(indexed)
      assert.equal(indexed?.status, 'indexed')
      const memory = await loadRelevantMemory('quiver-ingest-token', knowledgeId)
      assert.ok(memory.files.some((name) => name.startsWith('upload-loop-test')))
      assert.ok(memory.snippets.some((snip) => snip.includes('quiver-ingest-token')))
      const touched = await touchKnowledgeEntry(knowledgeId)
      assert.ok(touched)
      assert.ok(touched && touched.lastUsedAt >= indexed!.lastUsedAt)
    } finally {
      if (storedOriginal) await fs.unlink(path.join(ARTEMIS_DATA, storedOriginal)).catch(() => undefined)
      if (storedExtract) await fs.unlink(path.join(ARTEMIS_DATA, storedExtract)).catch(() => undefined)
      await fs.writeFile(activity, before, 'utf8')
      if (beforeIndex) await fs.writeFile(indexFile, beforeIndex, 'utf8')
      else await fs.rm(indexFile, { force: true })
    }
  })
})
