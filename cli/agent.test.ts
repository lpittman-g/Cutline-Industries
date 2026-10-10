import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseToolCall, protocolPrompt, runTool, type ToolCall } from './agent.ts';

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'artemis-agent-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.ts'), 'export class Widget {}\n');
  writeFileSync(join(root, 'README.md'), 'A Widget demo\n');
  return root;
}

test('a bare reply has no tool call', () => {
  assert.equal(parseToolCall('Here is the answer.'), null);
});

test('a fenced search block is found even with text around it', () => {
  const reply = 'Let me look.\n```search\n{"name":"glob","arguments":{"pattern":"*.ts"}}\n```';
  assert.deepEqual(parseToolCall(reply), { name: 'glob', arguments: { pattern: '*.ts' } });
});

test('the gateway\'s own <tool_call> markup is NOT used', () => {
  // The orchestrator strips that markup and runs the tool server-side, so a client
  // tool written that way never arrives; the user sees "unfinished tool call".
  assert.equal(parseToolCall('<tool_call>{"name":"glob","arguments":{}}</tool_call>'), null);
});

test('an unlabelled fence is accepted, because models emit one', () => {
  assert.deepEqual(parseToolCall('```\n{"name":"glob","arguments":{}}\n```'), { name: 'glob', arguments: {} });
});

test('a reply that is only a JSON object is treated as a search', () => {
  assert.deepEqual(parseToolCall('{"name":"glob","arguments":{"pattern":"*.ts"}}'), { name: 'glob', arguments: { pattern: '*.ts' } });
});

test('ordinary prose mentioning braces is still an answer, not a search', () => {
  assert.equal(parseToolCall('The config is {} by default, so nothing is set.'), null);
});

test('malformed JSON is reported back to the model, not thrown', () => {
  // The model can usually repair it; crashing the session cannot.
  const call = parseToolCall('```search\n{name: glob}\n```');
  assert.ok(call && 'error' in call);
});

test('a call with no name is rejected', () => {
  const call = parseToolCall('```search\n{"arguments":{}}\n```');
  assert.ok(call && 'error' in call && /needs a "name"/.test(call.error));
});

test('missing arguments default to an empty object rather than failing', () => {
  assert.deepEqual(parseToolCall('```search\n{"name":"glob"}\n```'), { name: 'glob', arguments: {} });
});

test('glob returns the matching paths', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'glob', arguments: { pattern: '**/*.ts' } });
  assert.ok(out.ok);
  assert.equal(out.detail, 'src/a.ts');
  assert.match(out.summary, /1 file$/);
});

test('grep cites path and line so the answer can be checked', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'grep', arguments: { expression: 'Widget', pattern: '**/*.ts' } });
  assert.equal(out.detail, 'src/a.ts:1: export class Widget {}');
});

test('grep given only a pattern treats it as the expression', async () => {
  // Models conflate the two argument names constantly; guessing right beats an error.
  const root = tree();
  const out = await runTool(root, { name: 'grep', arguments: { pattern: 'Widget' } });
  assert.ok(out.ok && out.detail.includes('src/a.ts:1'));
  assert.ok(out.detail.includes('README.md:1'));
});

test('read returns numbered lines', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'read', arguments: { path: 'src/a.ts' } });
  assert.match(out.detail, /^1\texport class Widget/);
});

test('a path outside the tree fails as a result, not an exception', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'read', arguments: { path: '../../etc/passwd' } });
  assert.equal(out.ok, false);
  assert.match(out.detail, /outside the working directory/);
});

test('an unknown tool is answered with the list of real ones', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'vector_search', arguments: {} } as ToolCall);
  assert.equal(out.ok, false);
  assert.match(out.detail, /There is no tool called "vector_search"/);
  assert.match(out.detail, /grep/);
});

test('a bad regular expression comes back as a readable failure', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'grep', arguments: { expression: '(' } });
  assert.equal(out.ok, false);
  assert.match(out.detail, /not a valid regular expression/);
});

test('the protocol prompt names the working directory and forbids guessing', () => {
  const prompt = protocolPrompt('/work/repo');
  assert.ok(prompt.includes('/work/repo'));
  assert.match(prompt, /never guess/);
  assert.match(prompt, /path:line/);
});

test('a case-sensitive miss says what to try next', async () => {
  // Otherwise the model greps "price", misses MONTHLY_PRICE_USD, and reports that
  // the repo has no pricing. Observed against the real gateway.
  const root = tree();
  const out = await runTool(root, { name: 'grep', arguments: { expression: 'widget' } });
  assert.ok(out.ok);
  assert.match(out.detail, /case-sensitive/);
  assert.match(out.detail, /ignore_case/);
});

test('an explicitly case-insensitive miss is reported plainly', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'grep', arguments: { expression: 'nothinghere', ignore_case: true } });
  assert.equal(out.detail, 'no matches');
});

test('ignore_case actually widens the search', async () => {
  const root = tree();
  const out = await runTool(root, { name: 'grep', arguments: { expression: 'widget', ignore_case: true } });
  assert.ok(out.detail.includes('src/a.ts:1'));
});
