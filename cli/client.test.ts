import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArtemisError, Client } from './client.ts';
import { AnswerWriter, externalBanner, renderModels, type Term } from './render.ts';
import type { ServerEvent } from './sse.ts';

const CONFIG = { baseUrl: 'https://gateway.example', apiKey: 'art-test-key' };

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function recorder(response: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response();
  }) as unknown as typeof fetch;
  return { calls, impl };
}

function fakeTerm(): Term & { stdout: string; stderr: string } {
  const term = {
    stdout: '',
    stderr: '',
    colour: false,
    out(text: string) { term.stdout += text; },
    err(text: string) { term.stderr += text; },
  };
  return term;
}

test('the key travels as a Bearer header, never in the URL', async () => {
  const { calls, impl } = recorder(() => new Response(JSON.stringify({ models: [] }), { status: 200 }));
  await new Client(CONFIG, impl).models();
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer art-test-key');
  assert.ok(!calls[0]?.url.includes('art-test-key'), 'a key in the URL lands in server logs');
  assert.equal(calls[0]?.url, 'https://gateway.example/v1/models');
});

test('no key configured means no Authorization header, not an empty one', async () => {
  const { calls, impl } = recorder(() => new Response(JSON.stringify({ models: [] }), { status: 200 }));
  await new Client({ baseUrl: CONFIG.baseUrl }, impl).models();
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.ok(!('Authorization' in headers));
});

test('streaming yields each event in order', async () => {
  const { impl } = recorder(() => sseResponse([
    'event: token\ndata: {"type":"token","text":"he"}\n\n',
    'data: {"type":"token","text":"llo"}\n\n',
    'data: {"type":"done","answer":"hello"}\n\n',
  ]));
  const seen: ServerEvent[] = [];
  for await (const event of new Client(CONFIG, impl).stream({ message: 'hi' })) seen.push(event);
  assert.deepEqual(seen.map((e) => e.type), ['token', 'token', 'done']);
});

test('the error body is shown, not a bare status code', async () => {
  const { impl } = recorder(() => new Response(
    JSON.stringify({ error: 'the grok model is not included in the free plan', upgrade: '/v1/plans' }),
    { status: 402 },
  ));
  await assert.rejects(
    new Client(CONFIG, impl).models(),
    (error: ArtemisError) => {
      assert.equal(error.status, 402);
      assert.match(error.message, /not included in the free plan/);
      assert.equal(error.upgrade, '/v1/plans');
      return true;
    },
  );
});

test('a non-JSON error page still produces an honest message', async () => {
  const { impl } = recorder(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  await assert.rejects(new Client(CONFIG, impl).models(), /502/);
});

test('401 says how to fix it', async () => {
  const { impl } = recorder(() => new Response(JSON.stringify({ error: 'missing API key' }), { status: 401 }));
  await assert.rejects(new Client(CONFIG, impl).models(), /artemis config --key/);
});

test('an unreachable gateway reports the address, not a stack trace', async () => {
  const impl = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  await assert.rejects(
    new Client(CONFIG, impl).models(),
    (error: ArtemisError) => error.status === 0 && /gateway\.example/.test(error.message),
  );
});

// ------------------------------------------------------------------ output

test('the answer goes to stdout and the running commentary to stderr', () => {
  // So that `artemis "q" > out.txt` leaves the answer alone in out.txt.
  const term = fakeTerm();
  const writer = new AnswerWriter(term);
  writer.handle({ type: 'tool_call', name: 'web_search' });
  writer.handle({ type: 'token', text: 'The answer' });
  writer.handle({ type: 'tool_result', name: 'web_search', ok: true });
  writer.handle({ type: 'done', answer: 'The answer' });
  assert.equal(term.stdout, 'The answer');
  assert.match(term.stderr, /web_search/);
});

test('a revision is announced rather than silently swapped', () => {
  const term = fakeTerm();
  const writer = new AnswerWriter(term);
  writer.handle({ type: 'token', text: 'wrong' });
  writer.handle({ type: 'replace', text: 'right' });
  assert.equal(writer.answer, 'right');
  assert.match(term.stderr, /revised after review/);
});

test('a non-streaming done event still prints the answer once', () => {
  const term = fakeTerm();
  const writer = new AnswerWriter(term);
  writer.handle({ type: 'done', answer: 'only' });
  assert.equal(term.stdout, 'only');
});

test('an external model is announced on stderr before it answers', () => {
  const term = fakeTerm();
  externalBanner(term, { id: 'grok', display: 'Grok', provider: 'xai', external: true, available: true });
  assert.match(term.stderr, /not Artemis/);
  assert.equal(term.stdout, '', 'the banner must not pollute a redirected answer');
});

test('Artemis itself gets no external banner', () => {
  const term = fakeTerm();
  externalBanner(term, { id: 'artemis', display: 'Artemis', provider: 'artemis', external: false, available: true });
  assert.equal(term.stderr, '');
});

test('the model list marks the current model, third parties and what cannot serve', () => {
  const term = fakeTerm();
  const text = renderModels(term, [
    { id: 'artemis', display: 'Artemis', provider: 'artemis', external: false, available: true },
    { id: 'grok', display: 'Grok', provider: 'xai', external: true, available: false },
  ], 'artemis');
  const [first, second] = text.split('\n');
  assert.match(String(first), /^\* artemis/);
  assert.match(String(second), /third party/);
  assert.match(String(second), /unavailable/);
});
