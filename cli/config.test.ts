import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_BASE_URL, maskKey, readConfig, writeConfig } from './config.ts';

function scratch(): string {
  return join(mkdtempSync(join(tmpdir(), 'artemis-cli-')), 'config.json');
}

test('a missing config yields defaults rather than throwing', () => {
  const config = readConfig(join(scratch(), 'nope.json'), {});
  assert.equal(config.baseUrl, DEFAULT_BASE_URL);
  assert.equal(config.apiKey, undefined);
});

test('an unreadable config does not break the CLI', () => {
  const path = scratch();
  writeFileSync(path, 'not json at all');
  assert.equal(readConfig(path, {}).baseUrl, DEFAULT_BASE_URL);
});

test('the environment overrides the file', () => {
  const path = scratch();
  writeConfig({ baseUrl: 'https://stored.example', apiKey: 'art-stored' }, path);
  const config = readConfig(path, { ARTEMIS_BASE_URL: 'https://env.example', ARTEMIS_API_KEY: 'art-env' });
  assert.equal(config.baseUrl, 'https://env.example');
  assert.equal(config.apiKey, 'art-env');
});

test('writing never persists a value that only the environment supplied', () => {
  // Otherwise a CI secret would be written to the runner's disk by any config write.
  const path = scratch();
  process.env.ARTEMIS_API_KEY = 'art-ci-secret';
  try {
    writeConfig({ baseUrl: 'https://kept.example' }, path);
  } finally {
    delete process.env.ARTEMIS_API_KEY;
  }
  assert.equal(readConfig(path, {}).apiKey, undefined);
  assert.equal(readConfig(path, {}).baseUrl, 'https://kept.example');
});

test('the config file is owner-readable only', () => {
  const path = scratch();
  writeConfig({ apiKey: 'art-key' }, path);
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('an already-permissive file is tightened on write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'artemis-cli-'));
  mkdirSync(join(dir, 'inner'));
  const path = join(dir, 'inner', 'config.json');
  writeFileSync(path, '{}', { mode: 0o644 });
  writeConfig({ apiKey: 'art-key' }, path);
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('a key is masked, never shown', () => {
  assert.equal(maskKey(undefined), 'not set');
  const masked = maskKey('art-abcdefghijklmnop');
  assert.ok(!masked.includes('defghijklm'));
  assert.ok(masked.startsWith('art-') && masked.endsWith('mnop'));
  assert.equal(maskKey('short'), '*****');
});
