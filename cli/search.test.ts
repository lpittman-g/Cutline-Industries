import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LIMITS, confine, globFiles, grepFiles, readFileSlice } from './search.ts';

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'artemis-search-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'node_modules', 'left-pad'), { recursive: true });
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, 'index.ts'), 'export const answer = 42;\n');
  writeFileSync(join(root, 'src', 'deep.ts'), 'function findMe() {\n  return 1;\n}\n');
  writeFileSync(join(root, 'src', 'notes.md'), 'findMe is mentioned here too\n');
  writeFileSync(join(root, 'node_modules', 'left-pad', 'index.js'), 'findMe\n');
  writeFileSync(join(root, '.git', 'config'), 'findMe\n');
  return root;
}

test('a glob finds files at the root and in subdirectories', async () => {
  const root = tree();
  assert.deepEqual(await globFiles(root, '**/*.ts'), ['index.ts', 'src/deep.ts']);
});

test('noisy directories are skipped by default', async () => {
  const root = tree();
  const found = await globFiles(root, '**/*');
  assert.ok(!found.some((p) => p.startsWith('node_modules/')));
  assert.ok(!found.some((p) => p.startsWith('.git/')));
});

test('naming a skipped directory opts back into it', async () => {
  // Otherwise "what version of left-pad is vendored?" would be unanswerable.
  const root = tree();
  const found = await globFiles(root, 'node_modules/**/*.js');
  assert.deepEqual(found, ['node_modules/left-pad/index.js']);
});

test('grep reports path and line number, so a claim can be checked', async () => {
  const root = tree();
  const hits = await grepFiles(root, 'findMe', '**/*.ts');
  assert.deepEqual(hits, [{ path: 'src/deep.ts', line: 1, text: 'function findMe() {' }]);
});

test('grep narrows by glob rather than searching everything', async () => {
  const root = tree();
  const all = await grepFiles(root, 'findMe', '**/*');
  assert.deepEqual(all.map((h) => h.path).sort(), ['src/deep.ts', 'src/notes.md']);
});

test('an invalid expression explains itself instead of crashing the session', async () => {
  const root = tree();
  await assert.rejects(grepFiles(root, '('), /not a valid regular expression/);
});

test('results are capped so a wide search cannot eat the context window', async () => {
  const root = mkdtempSync(join(tmpdir(), 'artemis-search-'));
  writeFileSync(join(root, 'big.txt'), 'match\n'.repeat(500));
  const hits = await grepFiles(root, 'match', '**/*', { limit: 10 });
  assert.equal(hits.length, 10);
});

test('a very long line is clipped, not sent whole', async () => {
  const root = mkdtempSync(join(tmpdir(), 'artemis-search-'));
  writeFileSync(join(root, 'min.js'), 'x'.repeat(5000) + 'needle\n');
  const [hit] = await grepFiles(root, 'needle');
  assert.ok((hit as { text: string }).text.length <= LIMITS.lineLength + 2);
});

test('binary files are skipped', async () => {
  const root = mkdtempSync(join(tmpdir(), 'artemis-search-'));
  writeFileSync(join(root, 'blob.bin'), Buffer.from([0x6e, 0x65, 0x65, 0x64, 0x00, 0x6c, 0x65]));
  assert.deepEqual(await grepFiles(root, 'need'), []);
});

test('read returns numbered lines and says how much more there is', async () => {
  const root = tree();
  const slice = await readFileSlice(root, 'src/deep.ts', 1, 2);
  assert.equal(slice.from, 1);
  assert.equal(slice.to, 2);
  assert.equal(slice.total, 4);
  assert.match(slice.text, /^1\tfunction findMe\(\) \{/);
});

// ------------------------------------------------------------------ containment

test('..  cannot escape the working directory', async () => {
  const root = tree();
  await assert.rejects(confine(root, '../../etc/passwd'), /outside the working directory/);
  await assert.rejects(readFileSlice(root, '../../etc/passwd'), /outside the working directory/);
});

test('an absolute path cannot escape either', async () => {
  const root = tree();
  await assert.rejects(confine(root, '/etc/passwd'), /outside the working directory/);
});

test('a symlink pointing out of the tree is an escape and is refused', async () => {
  // The lexical check alone passes this, which is exactly why realpath is used.
  const root = tree();
  symlinkSync('/etc', join(root, 'escape'));
  await assert.rejects(confine(root, 'escape/passwd'), /outside the working directory/);
});

test('a path inside the tree is allowed', async () => {
  const root = tree();
  assert.match(await confine(root, 'src/deep.ts'), /src\/deep\.ts$/);
});
