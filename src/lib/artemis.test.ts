import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ARTEMIS_COPY,
  CAPABILITIES,
  DEFAULT_VOICE,
  MEMORY_SECTIONS,
  PROCESS_STEPS,
  VOICES,
  parseConsoleView,
  parseQuiverEngine,
} from './artemis'

describe('Artemis landing copy', () => {
  it('keeps a short action-first description', () => {
    assert.equal(ARTEMIS_COPY.name, 'Artemis')
    assert.match(ARTEMIS_COPY.kicker, /Cutline Industries/)
    assert.ok(ARTEMIS_COPY.description.includes('operational interface'))
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

  it('maps engine query to orion or iron', () => {
    assert.equal(parseQuiverEngine(null), 'orion')
    assert.equal(parseQuiverEngine('orion'), 'orion')
    assert.equal(parseQuiverEngine('iron'), 'iron')
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
    assert.equal(PROCESS_STEPS.at(-1)?.label, 'Updating knowledge')
  })
})
