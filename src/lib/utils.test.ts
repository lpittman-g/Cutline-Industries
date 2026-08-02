import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clamp, formatClock, formatTime, parseTimestamp, scoreClip } from './utils'

describe('clamp', () => {
  it('keeps values within bounds', () => {
    assert.equal(clamp(5, 0, 10), 5)
    assert.equal(clamp(-1, 0, 10), 0)
    assert.equal(clamp(99, 0, 10), 10)
  })
})

describe('formatTime', () => {
  it('formats sub-hour timestamps', () => {
    assert.equal(formatTime(65.4), '1:05.4')
  })

  it('returns zero for invalid input', () => {
    assert.equal(formatTime(-1), '0:00')
    assert.equal(formatTime(Number.NaN), '0:00')
  })
})

describe('formatClock', () => {
  it('zero-pads hours, minutes, and seconds', () => {
    assert.equal(formatClock(3661), '01:01:01')
  })
})

describe('parseTimestamp', () => {
  it('parses seconds, mm:ss, and hh:mm:ss', () => {
    assert.equal(parseTimestamp('42'), 42)
    assert.equal(parseTimestamp('1:30'), 90)
    assert.equal(parseTimestamp('1:01:01'), 3661)
  })

  it('returns null for empty or invalid input', () => {
    assert.equal(parseTimestamp(''), null)
    assert.equal(parseTimestamp('bad'), null)
  })
})

describe('scoreClip', () => {
  it('rewards ideal Short duration and metadata', () => {
    const score = scoreClip({
      duration: 22,
      hasHook: true,
      hasTitle: true,
      hashtags: 4,
      hasCta: true,
    })
    assert.ok(score >= 90)
  })
})
