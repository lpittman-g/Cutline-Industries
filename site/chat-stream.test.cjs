const test = require('node:test');
const assert = require('node:assert/strict');
const { readEvents } = require('./chat-stream.js');
function stream(text, size = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  }});
}
test('handles split UTF-8 and CRLF SSE framing', async () => {
  const seen = [];
  await readEvents(stream('event: token\r\ndata: {"type":"token","text":"café 🚀"}\r\n\r\ndata: {"type":"done","answer":"café 🚀"}\r\n\r\n'), e => seen.push(e));
  assert.deepEqual(seen, [{ type: 'token', text: 'café 🚀' }, { type: 'done', answer: 'café 🚀' }]);
});
test('supports multiline data and a final frame without a trailing newline', async () => {
  const seen = [];
  await readEvents(stream(': keepalive\ndata: {"type":"error",\ndata: "message":"unavailable"}'), e => seen.push(e));
  assert.deepEqual(seen, [{ type: 'error', message: 'unavailable' }]);
});
test('malformed event fails rather than silently dropping output', async () => {
  await assert.rejects(() => readEvents(stream('data: {bad json}\n\n'), () => {}), SyntaxError);
});
test('propagates stream failures', async () => {
  const broken = new ReadableStream({ start(controller) { controller.error(new Error('disconnected')); }});
  await assert.rejects(() => readEvents(broken, () => {}), /disconnected/);
});
