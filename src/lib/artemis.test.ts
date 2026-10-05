import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ARTEMIS_COPY,
  CAPABILITIES,
  DEFAULT_VOICE,
  MEMORY_SECTIONS,
  MEMORY_SOURCES,
  MEMORY_ACTIONS,
  PROCESS_STEPS,
  STEP_MARKS,
  UPLOAD_LABELS,
  VOICES,
  askAboutFilePrompt,
  formatRelativeTime,
  isAllowedUpload,
  parseConsoleView,
  parseMemorySection,
  parseQuiverEngine,
  COMMAND_MENU_ITEMS,
  commandMenuPath,
  commandMenuShortcutLabel,
  filterCommandItems,
  isCommandMenuHotkey,
} from './artemis'

describe('Artemis landing copy', () => {
  it('keeps a short action-first description', () => {
    assert.equal(ARTEMIS_COPY.name, 'Artemis')
    assert.match(ARTEMIS_COPY.kicker, /Cutline Industries/)
    assert.ok(ARTEMIS_COPY.description.includes('Cutline Industries'))
    assert.ok(ARTEMIS_COPY.description.length < 220)
  })

  it('exposes only Bow, Orion, and Chronicler capability cards', () => {
    assert.deepEqual(
      CAPABILITIES.map((c) => c.name),
      ['The Bow', 'Orion', 'Chronicler'],
    )
  })
})

describe('console query parsing', () => {
  it('defaults unknown views to chat', () => {
    assert.equal(parseConsoleView(null), 'chat')
    assert.equal(parseConsoleView('bow'), 'chat')
    assert.equal(parseConsoleView('logs'), 'logs')
    assert.equal(parseConsoleView('files'), 'files')
    assert.equal(parseConsoleView('memory'), 'memory')
  })

  it('maps engine query to orion, iron, or drive', () => {
    assert.equal(parseQuiverEngine(null), 'orion')
    assert.equal(parseQuiverEngine('orion'), 'orion')
    assert.equal(parseQuiverEngine('iron'), 'iron')
    assert.equal(parseQuiverEngine('drive'), 'drive')
  })
})

describe('command menu', () => {
  it('lists the top-bar commands', () => {
    assert.deepEqual(
      COMMAND_MENU_ITEMS.map((item) => `${item.icon} ${item.label}`),
      [
        '⌘ New Hunt',
        '💬 New Chat',
        '🎙 Voice Mode',
        '📂 Upload File',
        '🧠 Chronicle',
        '🔍 Research',
        '⚡ Run Action',
        '📋 Logs',
        '⚙ Settings',
      ],
    )
  })

  it('routes each command to a console surface', () => {
    assert.match(commandMenuPath('new-hunt', '9') ?? '', /view=chat.*fresh=hunt/)
    assert.match(commandMenuPath('new-chat', '9') ?? '', /view=chat.*fresh=chat/)
    assert.match(commandMenuPath('voice', '9') ?? '', /panel=voice/)
    assert.match(commandMenuPath('upload', '9') ?? '', /view=files.*upload=1/)
    assert.equal(commandMenuPath('chronicle'), '/console?view=memory&section=projects')
    assert.equal(commandMenuPath('research'), '/console?view=memory&section=research')
    assert.equal(commandMenuPath('action'), null)
    assert.equal(commandMenuPath('logs'), '/console?view=logs')
    assert.equal(commandMenuPath('settings'), '/console?view=logs&panel=lunar')
  })

  it('opens on ⌘K and Ctrl+K and filters items', () => {
    assert.equal(isCommandMenuHotkey({ key: 'k', metaKey: true, ctrlKey: false }), true)
    assert.equal(isCommandMenuHotkey({ key: 'K', metaKey: false, ctrlKey: true }), true)
    assert.equal(isCommandMenuHotkey({ key: 'k', metaKey: false, ctrlKey: false }), false)
    assert.equal(commandMenuShortcutLabel('MacIntel'), '⌘K')
    assert.equal(commandMenuShortcutLabel('Win32'), 'Ctrl+K')
    assert.deepEqual(
      filterCommandItems(COMMAND_MENU_ITEMS, 'voice').map((item) => item.id),
      ['voice'],
    )
    assert.deepEqual(
      filterCommandItems(COMMAND_MENU_ITEMS, 'memory').map((item) => item.id),
      ['chronicle'],
    )
    assert.equal(filterCommandItems(COMMAND_MENU_ITEMS, 'zzz').length, 0)
  })
})

describe('voices and memory', () => {
  it('defaults to Astra among four voices', () => {
    assert.equal(DEFAULT_VOICE, 'astra')
    assert.deepEqual(Object.keys(VOICES), ['astra', 'orion', 'nova', 'sage'])
  })

  it('lists memory sections and processing steps', () => {
    assert.deepEqual(MEMORY_SECTIONS, [
      'projects',
      'decisions',
      'preferences',
      'people',
      'files',
      'research',
      'conversations',
    ])
    assert.equal(PROCESS_STEPS[0].label, 'Understanding request')
    assert.equal(PROCESS_STEPS.find((s) => s.id === 'extract')?.label, 'Extracting text')
    assert.equal(PROCESS_STEPS.find((s) => s.id === 'chunk')?.label, 'Chunking document')
    assert.equal(PROCESS_STEPS.find((s) => s.id === 'index')?.label, 'Indexing chunks')
    assert.equal(PROCESS_STEPS.at(-1)?.label, 'Updating knowledge')
  })

  it('maps Files onto knowledge/ and parses section query', () => {
    assert.equal(MEMORY_SOURCES.files, 'knowledge/')
    assert.equal(MEMORY_SOURCES.projects, 'projects.json')
    assert.equal(parseMemorySection(null), 'projects')
    assert.equal(parseMemorySection('people'), 'people')
    assert.equal(parseMemorySection('unknown'), 'projects')
  })

  it('uses transparent memory actions and live process marks', () => {
    assert.deepEqual(MEMORY_ACTIONS, ['Edit', 'Pin', 'Forget', 'Export'])
    assert.equal(STEP_MARKS.in_progress, '◉')
    assert.equal(STEP_MARKS.done, '✓')
    assert.equal(STEP_MARKS.pending, '○')
  })

  it('accepts console upload families', () => {
    assert.deepEqual([...UPLOAD_LABELS], ['PDF', 'DOCX', 'TXT', 'JSON', 'CSV', 'XLSX', 'Images', 'Code'])
    assert.equal(isAllowedUpload('brief.pdf'), true)
    assert.equal(isAllowedUpload('notes.docx'), true)
    assert.equal(isAllowedUpload('data.csv'), true)
    assert.equal(isAllowedUpload('sheet.xlsx'), true)
    assert.equal(isAllowedUpload('shot.png'), true)
    assert.equal(isAllowedUpload('handler.ts'), true)
    assert.equal(isAllowedUpload('virus.exe'), false)
  })

  it('formats file-card relative time and ask prompt', () => {
    const now = Date.parse('2026-09-20T15:00:00.000Z')
    assert.equal(formatRelativeTime('2026-09-20T14:57:00.000Z', now), '3m ago')
    assert.equal(formatRelativeTime('2026-09-20T14:59:40.000Z', now), 'just now')
    assert.equal(askAboutFilePrompt('Artemis Architecture.pdf'), 'What should I know about Artemis Architecture.pdf?')
  })
})
