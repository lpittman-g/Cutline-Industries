import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesGlob } from './glob.ts';

test('* stops at a directory boundary', () => {
  assert.ok(matchesGlob('index.ts', '*.ts'));
  assert.ok(!matchesGlob('src/index.ts', '*.ts'));
});

test('**/ crosses directories and also matches none of them', () => {
  // The expectation everyone has: **/*.ts finds a file at the root too.
  assert.ok(matchesGlob('index.ts', '**/*.ts'));
  assert.ok(matchesGlob('src/deep/index.ts', '**/*.ts'));
});

test('a leading directory is respected', () => {
  assert.ok(matchesGlob('cli/args.ts', 'cli/**/*.ts'));
  assert.ok(!matchesGlob('server/args.ts', 'cli/**/*.ts'));
});

test('braces offer alternatives', () => {
  assert.ok(matchesGlob('a.ts', '*.{ts,tsx}'));
  assert.ok(matchesGlob('a.tsx', '*.{ts,tsx}'));
  assert.ok(!matchesGlob('a.js', '*.{ts,tsx}'));
});

test('? matches one character but never a slash', () => {
  assert.ok(matchesGlob('ab.ts', '?b.ts'));
  assert.ok(!matchesGlob('a/b.ts', '?b.ts'));
});

test('a dot in the pattern is literal, not any-character', () => {
  assert.ok(!matchesGlob('packageXjson', 'package.json'));
  assert.ok(matchesGlob('package.json', 'package.json'));
});

test('character classes work', () => {
  assert.ok(matchesGlob('v2.ts', 'v[0-9].ts'));
  assert.ok(!matchesGlob('vx.ts', 'v[0-9].ts'));
});
