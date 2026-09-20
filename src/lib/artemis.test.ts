import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ARTEMIS_COPY,
  CAPABILITIES,
  formatHuntHistory,
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
  })

  it('maps engine query to orion or iron', () => {
    assert.equal(parseQuiverEngine(null), 'orion')
    assert.equal(parseQuiverEngine('orion'), 'orion')
    assert.equal(parseQuiverEngine('iron'), 'iron')
  })
})

describe('formatHuntHistory', () => {
  it('renders operator and artemis turns', () => {
    const text = formatHuntHistory([
      { role: 'operator', content: 'Draw the string' },
      { role: 'artemis', content: 'Ready.' },
    ])
    assert.match(text, /\[OPERATOR\]/)
    assert.match(text, /\[ARTEMIS\]/)
    assert.match(text, /Draw the string/)
  })
})
