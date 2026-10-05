const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('./api-client.js');
test('rejects successful HTML fallback instead of pretending signup worked', async () => {
  global.fetch = async () => new Response('<html>Home</html>', { status: 200 });
  await assert.rejects(request('/api/auth/signup', { method: 'POST', body: {} }), error => error.code === 503);
});
test('preserves missing-route status for a non-JSON 404', async () => {
  global.fetch = async () => new Response('NOT_FOUND', { status: 404 });
  await assert.rejects(request('/api/me'), error => error.code === 404);
});
test('uses same-origin credentials and sends CSRF on authenticated writes', async () => {
  let captured;
  global.fetch = async (path, options) => { captured = { path, options }; return new Response(JSON.stringify({ ok: true })); };
  assert.deepEqual(await request('/api/settings', { method: 'PATCH', body: { retention_days: 30 } }, { csrf: 'test-csrf' }), { ok: true });
  assert.equal(captured.options.credentials, 'same-origin');
  assert.equal(captured.options.headers['X-CSRF-Token'], 'test-csrf');
  assert.deepEqual(JSON.parse(captured.options.body), { retention_days: 30 });
});
test('rejects an external endpoint before sending credentials', async () => {
  global.fetch = async () => { throw new Error('Fetch must not execute'); };
  await assert.rejects(request('//other.example/api/me'), /Invalid application endpoint/);
});
test('preserves a server validation message', async () => {
  global.fetch = async () => new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
  await assert.rejects(request('/api/auth/signup'), error => error.code === 400 && error.message === 'Invalid email');
});
