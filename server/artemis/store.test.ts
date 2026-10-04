import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_VOICE,
  HISTORY_LIMIT,
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
  historyToMessages,
  runArtemis,
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
        'Extracting text',
        'Chunking document',
        'Indexing chunks',
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
    assert.ok(board.notes.some((item) => item.title.includes('Bow')))
    assert.equal(MEMORY_SOURCES.notes, 'memory.json')
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

describe('runArtemis', () => {
  it('maps recent conversation history to model roles', () => {
    const history = Array.from({ length: HISTORY_LIMIT + 4 }, (_, i) => ({
      role: i % 2 === 0 ? ('operator' as const) : ('artemis' as const),
      content: `m${i}`,
      at: '2026-01-01T00:00:00.000Z',
    }))
    const messages = historyToMessages(history)
    assert.equal(messages.length, HISTORY_LIMIT)
    assert.deepEqual(messages[0], { role: 'user', content: 'm4' })
    assert.deepEqual(messages.at(-1), { role: 'assistant', content: `m${HISTORY_LIMIT + 3}` })
  })

  it('streams the stub reply in chunks when no model key is set', async () => {
    const saved = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      const chunks: string[] = []
      const reply = await runArtemis({
        message: 'status check',
        context: { voice: 'astra', snippets: [], projects: [], files: [] },
        voice: 'astra',
        onChunk: (text) => chunks.push(text),
      })
      assert.ok(chunks.length > 1)
      assert.equal(chunks.join(''), reply)
      assert.match(reply, /You said: status check/)
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved
    }
  })
})
