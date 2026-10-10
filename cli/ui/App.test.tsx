import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from 'ink-testing-library';
import { createElement } from 'react';

import { App, StatusBar } from './App.tsx';
import { short } from '../render.ts';
import type { Client, ModelInfo } from '../client.ts';
import type { ServerEvent } from '../sse.ts';

const ARTEMIS: ModelInfo = { id: 'artemis', display: 'Artemis', provider: 'artemis', external: false, available: true };
const GROK: ModelInfo = { id: 'grok', display: 'Grok', provider: 'xai', external: true, available: true };

/** A client whose replies are scripted, so the UI is tested, not the network. */
function scripted(replies: string[][]): Client {
  const queue = [...replies];
  return {
    async *stream(): AsyncGenerator<ServerEvent> {
      const pieces = queue.shift() ?? ['…'];
      for (const text of pieces) yield { type: 'token', text };
      yield { type: 'done', answer: pieces.join('') };
    },
    async models() { return [ARTEMIS, GROK]; },
  } as unknown as Client;
}

async function settle(ms = 120): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test('the status bar names Artemis without a warning', async () => {
  const { lastFrame } = render(createElement(StatusBar, { model: ARTEMIS, modelId: 'artemis', root: '/repo', search: true }));
  await settle();
  const frame = String(lastFrame());
  assert.match(frame, /Artemis/);
  assert.ok(!/leave Artemis/.test(frame));
});

test('the status bar warns, visibly and continuously, while a third-party model is selected', async () => {
  // Not a one-off line that scrolls away: it stays on screen for as long as it is true.
  const view = render(createElement(StatusBar, { model: GROK, modelId: 'grok', root: '/repo', search: true }));
  await settle();
  const frame = String(view.lastFrame());
  assert.match(frame, /Grok/);
  assert.match(frame, /not Artemis/);
  assert.match(frame, /xai/);
});

test('the status bar says whether files can be read', async () => {
  const onView = render(createElement(StatusBar, { model: ARTEMIS, modelId: 'artemis', root: '/repo', search: true }));
  const offView = render(createElement(StatusBar, { model: ARTEMIS, modelId: 'artemis', root: '/repo', search: false }));
  await settle();
  const on = String(onView.lastFrame());
  const off = String(offView.lastFrame());
  assert.match(on, /glob \+ grep/);
  assert.match(off, /no file access/);
});

test('a long path is shortened so the bar cannot overflow the terminal', () => {
  assert.equal(short('/a/b', 36), '/a/b');
  const long = short('/very/deep/' + 'x'.repeat(80), 36);
  assert.equal(long.length, 36);
  assert.ok(long.startsWith('…'));
});

test('an answer is streamed into the transcript under its question', async () => {
  const { lastFrame } = render(createElement(App, {
    client: scripted([['The ', 'answer ', 'is 42.']]),
    model: ARTEMIS, modelId: 'artemis', root: '/repo', search: false, initialPrompt: 'what is it?',
  }));
  await settle();
  const frame = String(lastFrame());
  assert.match(frame, /› what is it\?/);
  assert.match(frame, /The answer is 42\./);
});

test('each retrieval the model drives is shown as a readable line', async () => {
  // The point of globs over embeddings is that the retrieval is legible; if the UI
  // hid the searches, that advantage would exist only on paper.
  const { lastFrame } = render(createElement(App, {
    client: scripted([
      ['```search\n{"name":"glob","arguments":{"pattern":"**/*.ts"}}\n```'],
      ['Found it.'],
    ]),
    model: ARTEMIS, modelId: 'artemis', root: process.cwd(), search: true, initialPrompt: 'where is it?',
  }));
  await settle(300);
  const frame = String(lastFrame());
  assert.match(frame, /glob \*\*\/\*\.ts/);
  assert.match(frame, /Found it\./);
});

test('a failed turn shows the reason instead of an empty answer', async () => {
  const failing = {
    async *stream(): AsyncGenerator<ServerEvent> {
      yield { type: 'error', message: 'daily message limit reached' };
    },
    async models() { return [ARTEMIS]; },
  } as unknown as Client;
  const { lastFrame } = render(createElement(App, {
    client: failing, model: ARTEMIS, modelId: 'artemis', root: '/repo', search: false, initialPrompt: 'hi',
  }));
  await settle();
  assert.match(String(lastFrame()), /daily message limit reached/);
});

test('a line pasted as one chunk is submitted, not swallowed', async () => {
  // Terminals deliver a paste in one write, so the newline arrives inside `input`
  // and Ink's key.return is false. Checking only key.return froze the UI.
  const { stdin, lastFrame } = render(createElement(App, {
    client: scripted([['Received.']]),
    model: ARTEMIS, modelId: 'artemis', root: '/repo', search: false,
  }));
  await settle();
  stdin.write('how much does it cost?\r');
  await settle(250);
  const frame = String(lastFrame());
  assert.match(frame, /› how much does it cost\?/);
  assert.match(frame, /Received\./);
  assert.ok(!/cost\?\r/.test(frame), 'the newline must not survive into the draft');
});

test('typed characters accumulate and then send on Enter', async () => {
  const { stdin, lastFrame } = render(createElement(App, {
    client: scripted([['Done.']]),
    model: ARTEMIS, modelId: 'artemis', root: '/repo', search: false,
  }));
  await settle();
  for (const ch of 'hi') stdin.write(ch);
  await settle(60);
  assert.match(String(lastFrame()), /› hi/);
  stdin.write('\r');
  await settle(250);
  assert.match(String(lastFrame()), /Done\./);
});

// ------------------------------------------------------------------ the status bar

import type { ServerReading } from '../server.ts';

const UP: ServerReading = { reachable: true, model: 'artemis-1b', gpuCache: 0.42, running: 1, queued: 0 };
const DOWN: ServerReading = { reachable: false, model: '', gpuCache: null, running: null, queued: null, detail: 'connection refused' };

function bar(extra: Record<string, unknown>) {
  return render(createElement(StatusBar, {
    model: ARTEMIS, modelId: 'artemis', root: '/repo', search: true, ...extra,
  }));
}

test('before the first probe the bar says it is checking, not that the server is down', async () => {
  const view = bar({ state: 'unknown', health: null });
  await settle();
  const frame = String(view.lastFrame());
  assert.match(frame, /Checking server/);
  assert.ok(!/disconnected/i.test(frame));
});

test('a reachable idle server reads Ready and names the loaded model', async () => {
  const view = bar({ state: 'ready', health: UP });
  await settle();
  assert.match(String(view.lastFrame()), /Ready \(artemis-1b\)/);
});

test('generating shows the live token rate', async () => {
  const view = bar({ state: 'generating', rate: 18.4, health: UP });
  await settle();
  assert.match(String(view.lastFrame()), /Generating….*18\.4 tok\/s/s);
});

test('a near-full context warns and says what to do', async () => {
  const view = bar({ state: 'context', contextUsed: 3500, contextLimit: 4096, health: UP });
  await settle();
  const frame = String(view.lastFrame());
  assert.match(frame, /Context ~85%/);
  assert.match(frame, /clear room/);
});

test('a dead server shows the reason it gave', async () => {
  const view = bar({ state: 'offline', health: DOWN });
  await settle();
  assert.match(String(view.lastFrame()), /Server disconnected — connection refused/);
});

test('a GPU figure is shown only when the server published one', async () => {
  // Drawing 0% for "not told" would report an idle GPU, which is a different claim.
  const withGpu = bar({ state: 'ready', health: UP });
  const without = bar({ state: 'ready', health: { ...UP, gpuCache: null } });
  await settle();
  assert.match(String(withGpu.lastFrame()), /kv 42%/);
  assert.ok(!/kv /.test(String(without.lastFrame())));
});

test('context use is marked as an estimate, never as an exact count', async () => {
  const view = bar({ state: 'ready', contextUsed: 1000, contextLimit: 4096, health: UP });
  await settle();
  assert.match(String(view.lastFrame()), /ctx ~24% of 4096/);
});

test('the bar polls the server and recovers when it comes back', async () => {
  const readings: ServerReading[] = [DOWN, UP];
  let calls = 0;
  const probe = (async () => readings[Math.min(calls++, readings.length - 1)] as ServerReading) as never;
  const { lastFrame } = render(createElement(App, {
    client: scripted([['hi']]), model: ARTEMIS, modelId: 'artemis', root: '/repo',
    search: false, baseUrl: 'http://gpu-vm:8000', pollMs: 250, probe,
  }));
  await settle(80);                 // the first probe has answered, the second has not
  assert.match(String(lastFrame()), /Server disconnected/);
  await settle(350);                // the second probe lands and the bar recovers
  assert.match(String(lastFrame()), /Ready \(artemis-1b\)/);
});

test('the rate shown comes from the stream, not from a guess', async () => {
  const { lastFrame } = render(createElement(App, {
    client: scripted([['aaaaaaaa', 'bbbbbbbb', 'cccccccc']]),
    model: ARTEMIS, modelId: 'artemis', root: '/repo', search: false,
    baseUrl: 'http://gpu-vm:8000', pollMs: 0, initialPrompt: 'go',
  }));
  await settle(250);
  const frame = String(lastFrame());
  // Six tokens of text were streamed, so context use must be non-zero afterwards.
  assert.match(frame, /ctx ~/);
});
