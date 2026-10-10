import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTEXT_WARN, STATE_COLOUR, TokenMeter, approxTokens, contextShare, deriveState, statusText,
} from './metrics.ts';

test('the rate is measured from the first token, not from the request', () => {
  // Including the wait for the first token makes the number climb through the answer
  // and settle nowhere, which says nothing about how fast the GPU is running.
  let now = 1000;
  const meter = new TokenMeter(() => now);
  now = 5000;                   // four seconds of queueing before anything arrives
  meter.record('abcd', 1000);
  now = 6000;                   // one second of generating
  meter.record('abcdefgh');
  assert.equal(meter.firstTokenMs, 4000);
  assert.equal(meter.rate, 3);  // 3 tokens over 1s, not 3 over 5s
});

test('no rate is reported from too little evidence', () => {
  let now = 0;
  const meter = new TokenMeter(() => now);
  assert.equal(meter.rate, null, 'nothing recorded yet');
  meter.record('abcd');
  now = 50;
  assert.equal(meter.rate, null, 'a single chunk 50ms apart is noise, not a rate');
});

test('a meter resets between questions', () => {
  let now = 0;
  const meter = new TokenMeter(() => now);
  meter.record('abcd');
  now = 1000;
  meter.record('abcd');
  assert.ok((meter.rate ?? 0) > 0);
  meter.reset();
  assert.equal(meter.rate, null);
  assert.equal(meter.tokens, 0);
});

test('context share is bounded at one', () => {
  assert.equal(contextShare(2048, 4096), 0.5);
  assert.equal(contextShare(9000, 4096), 1);
  assert.equal(contextShare(100, 0), 0, 'an unknown limit is not a division by zero');
});

test('token estimation matches the rule the gateway bills with', () => {
  assert.equal(approxTokens('abcd'), 1);
  assert.equal(approxTokens(''), 1);
  assert.equal(approxTokens('a'.repeat(400)), 100);
});

// ------------------------------------------------------------------ states

test('each state has its specified colour', () => {
  assert.equal(STATE_COLOUR.ready, '#10B981');
  assert.equal(STATE_COLOUR.generating, '#3B82F6');
  assert.equal(STATE_COLOUR.context, '#F59E0B');
  assert.equal(STATE_COLOUR.offline, '#EF4444');
});

test('an unreachable server beats every other state', () => {
  assert.equal(deriveState(false, true, 0, 4096), 'offline');
});

test('generating beats a full context, which beats ready', () => {
  assert.equal(deriveState(true, true, 4000, 4096), 'generating');
  assert.equal(deriveState(true, false, 4000, 4096), 'context');
  assert.equal(deriveState(true, false, 10, 4096), 'ready');
});

test('before the first probe the state is unknown, not offline', () => {
  // Claiming the server is down while still dialling it is a false alarm.
  assert.equal(deriveState(null, false, 0, 4096), 'unknown');
});

test('the warning threshold is where answers start getting clipped', () => {
  assert.equal(deriveState(true, false, Math.ceil(4096 * CONTEXT_WARN), 4096), 'context');
  assert.equal(deriveState(true, false, Math.floor(4096 * CONTEXT_WARN) - 1, 4096), 'ready');
});

// ------------------------------------------------------------------ the line

const base = { rate: null, contextUsed: 0, contextLimit: 4096, model: 'artemis', server: 'local' } as const;

test('ready names the model', () => {
  assert.equal(statusText({ ...base, state: 'ready' }), 'Ready (artemis)');
});

test('generating shows the live rate once it is measurable', () => {
  assert.equal(statusText({ ...base, state: 'generating' }), 'Generating…');
  assert.equal(statusText({ ...base, state: 'generating', rate: 18.3 }), 'Generating… 18.3 tok/s');
});

test('a full context tells the user what to do about it', () => {
  const text = statusText({ ...base, state: 'context', contextUsed: 3600 });
  assert.match(text, /Context ~88%/);
  assert.match(text, /clear room/);
});

test('a disconnected server carries the reason when there is one', () => {
  assert.equal(statusText({ ...base, state: 'offline' }), 'Server disconnected');
  assert.match(statusText({ ...base, state: 'offline', detail: 'connection refused' }), /connection refused/);
});
