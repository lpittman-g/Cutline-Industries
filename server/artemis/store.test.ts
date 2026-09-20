import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_VOICE,
  MEMORY_KINDS,
  MEMORY_SOURCES,
  PROCESS_STEPS,
  VOICES,
  isVoiceId,
  knowledgeFileId,
  loadMemoryBoard,
  addMemoryItem,
  updateMemoryItem,
  forgetMemoryItem,
  safeKnowledgeName,
  scoreText,
  tokenize,
} from './store.ts'

describe('Artemis voices', () => {
  it('defaults to astra and lists four voices', () => {
    assert.equal(DEFAULT_VOICE, 'astra')
    assert.deepEqual(Object.keys(VOICES), ['astra', 'orion', 'nova', 'sage'])
    assert.equal(isVoiceId('astra'), true)
    assert.equal(isVoiceId('echo'), false)
  })
})

describe('processing steps', () => {
  it('covers the live stepper labels', () => {
    assert.deepEqual(
      PROCESS_STEPS.map((s) => s.label),
      [
        'Understanding request',
        'Searching Chronicle',
        'Reading project context',
        'Processing files',
        'Generating response',
        'Updating knowledge',
      ],
    )
  })
})

describe('memory kinds', () => {
  it('matches the Memory UI sections', () => {
    assert.deepEqual(MEMORY_KINDS, [
      'projects',
      'decisions',
      'preferences',
      'people',
      'files',
      'research',
      'conversations',
    ])
    assert.equal(MEMORY_SOURCES.files, 'knowledge/')
    assert.equal(MEMORY_SOURCES.conversations, 'conversations/')
  })

  it('derives stable knowledge file ids', () => {
    assert.equal(knowledgeFileId('artemis.md'), 'file_artemis_md')
    assert.equal(safeKnowledgeName('../etc/passwd'), 'passwd')
  })

  it('loads Files from knowledge/ docs', async () => {
    const board = await loadMemoryBoard()
    const titles = board.files.map((item) => item.title)
    assert.ok(titles.includes('artemis.md'))
    assert.ok(titles.includes('cutline.md'))
    assert.ok(titles.includes('integrations.md'))
    assert.ok(board.files.every((item) => item.path?.startsWith('knowledge/')))
    assert.ok(board.projects.some((item) => item.title === 'Artemis'))
  })

  it('adds, pins, and forgets a knowledge file', async () => {
    let id: string | undefined
    try {
      const item = await addMemoryItem('files', 'sidebar-test.md', '# Sidebar test')
      id = item.id
      assert.equal(item.path, 'knowledge/sidebar-test.md')
      assert.equal(item.title, 'sidebar-test.md')
      const pinned = await updateMemoryItem('files', item.id, { pinned: true })
      assert.equal(pinned?.pinned, true)
      const board = await loadMemoryBoard()
      const row = board.files.find((f) => f.id === item.id)
      assert.ok(row)
      assert.equal(row?.pinned, true)
      assert.match(row?.body ?? '', /Sidebar test/)
    } finally {
      if (id) assert.equal(await forgetMemoryItem('files', id), true)
    }
  })
})

describe('loadRelevantMemory scoring', () => {
  it('tokenizes and scores overlapping terms', () => {
    const tokens = tokenize('Remember Thermal clips for Artemis')
    assert.ok(tokens.includes('thermal'))
    assert.ok(tokens.includes('artemis'))
    assert.ok(!tokens.includes('for'))
    assert.ok(scoreText('Thermal Mission Control', tokens) >= 1)
    assert.equal(scoreText('unrelated potatoes', tokens), 0)
  })
})
