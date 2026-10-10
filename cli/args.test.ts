import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './args.ts';

test('a bare prompt is a chat', () => {
  const parsed = parseArgs(['what is 2+2?']);
  assert.equal(parsed.command, 'chat');
  assert.equal(parsed.prompt, 'what is 2+2?');
});

test('loose words are joined, so quoting is optional', () => {
  assert.equal(parseArgs(['what', 'is', '2+2?']).prompt, 'what is 2+2?');
});

test('a command word is recognised only in first position', () => {
  assert.equal(parseArgs(['models']).command, 'models');
  // Otherwise "artemis which models do I have" would list models instead of asking.
  const parsed = parseArgs(['which', 'models', 'do', 'I', 'have']);
  assert.equal(parsed.command, 'chat');
  assert.equal(parsed.prompt, 'which models do I have');
});

test('-- ends option parsing so a prompt may start with a dash', () => {
  const parsed = parseArgs(['--', '--not-an-option']);
  assert.equal(parsed.prompt, '--not-an-option');
  assert.equal(parsed.error, undefined);
});

test('model, brain and tier take values', () => {
  const parsed = parseArgs(['-m', 'grok', '--brain', 'venus', '--tier', 'gpt-2-sft', 'hello']);
  assert.equal(parsed.model, 'grok');
  assert.equal(parsed.brain, 'venus');
  assert.equal(parsed.tier, 'gpt-2-sft');
  assert.equal(parsed.prompt, 'hello');
});

test('an option missing its value is an error, not a silent default', () => {
  assert.match(String(parseArgs(['--model']).error), /needs a value/);
});

test('an unknown option is refused rather than treated as a prompt', () => {
  assert.match(String(parseArgs(['--colour']).error), /unknown option/);
});

test('a key passed as an argument is refused', () => {
  // argv is world-readable in `ps` and lands in shell history.
  const parsed = parseArgs(['config', '--key', 'art-secret-value']);
  assert.match(String(parsed.error), /do not pass a key as an argument/);
  assert.ok(!JSON.stringify(parsed).includes('art-secret-value'));
});

test('--key with no value asks for the prompted flow', () => {
  const parsed = parseArgs(['config', '--key']);
  assert.equal(parsed.setKey, true);
  assert.equal(parsed.error, undefined);
});

test('help and version win over anything else', () => {
  assert.equal(parseArgs(['models', '--help']).command, 'help');
  assert.equal(parseArgs(['-V']).command, 'version');
});
