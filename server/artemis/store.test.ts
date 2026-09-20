import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isVoiceId, scoreText, tokenize, VOICES, PROCESS_STEPS, MEMORY_KINDS, DEFAULT_VOICE } from './store.ts'

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
