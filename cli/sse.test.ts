import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventParser, type ServerEvent } from './sse.ts';

function collect(chunks: string[] | Uint8Array[], end = true): ServerEvent[] {
  const seen: ServerEvent[] = [];
  const parser = new EventParser((e) => seen.push(e));
  for (const chunk of chunks) parser.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  if (end) parser.end();
  return seen;
}

test('parses one event per blank line', () => {
  const seen = collect(['event: token\ndata: {"type":"token","text":"hi"}\n\n']);
  assert.deepEqual(seen, [{ type: 'token', text: 'hi' }]);
});

test('an event split across chunks arrives once, whole', () => {
  const seen = collect(['data: {"type":"to', 'ken","text":"hel', 'lo"}\n\n']);
  assert.deepEqual(seen, [{ type: 'token', text: 'hello' }]);
});

test('a multi-byte character split across chunks is not corrupted', () => {
  // The classic streaming bug: decoding each chunk alone turns this into two
  // replacement characters, and the user sees mojibake mid-answer.
  const bytes = new TextEncoder().encode('data: {"type":"token","text":"né"}\n\n');
  const seen = collect([bytes.slice(0, 31), bytes.slice(31)]);
  assert.deepEqual(seen, [{ type: 'token', text: 'né' }]);
});

test('handles CRLF line endings', () => {
  assert.deepEqual(collect(['data: {"type":"done"}\r\n\r\n']), [{ type: 'done' }]);
});

test('joins multi-line data fields', () => {
  const seen = collect(['data: {"type":"token",\ndata: "text":"two lines"}\n\n']);
  assert.deepEqual(seen, [{ type: 'token', text: 'two lines' }]);
});

test('end() flushes a final event that had no trailing blank line', () => {
  assert.deepEqual(collect(['data: {"type":"done","answer":"x"}\n']), [{ type: 'done', answer: 'x' }]);
});

test('a malformed frame is skipped, not thrown, and later events still arrive', () => {
  const seen = collect(['data: {not json}\n\n', 'data: {"type":"token","text":"ok"}\n\n']);
  assert.deepEqual(seen, [{ type: 'token', text: 'ok' }]);
});

test('ignores comments, retry lines and frames with no type', () => {
  const seen = collect([': keep-alive\n\n', 'retry: 500\n\n', 'data: {"answer":"x"}\n\n']);
  assert.deepEqual(seen, []);
});
