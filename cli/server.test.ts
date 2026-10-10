import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePrometheus, probeGpu, probeModels, probeServer, serverLabel, shortModel } from './server.ts';

function responder(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (url: string | URL | Request) => handler(String(url))) as unknown as typeof fetch;
}

test('an LM Studio model list is understood', async () => {
  // LM Studio and vLLM answer {data:[{id}]}.
  const fetchImpl = responder(() => new Response(JSON.stringify({ data: [{ id: 'lmstudio-community/Qwen2.5-Coder-7B-GGUF' }] })));
  const reading = await probeModels('http://localhost:1234', undefined, fetchImpl);
  assert.equal(reading.reachable, true);
  assert.equal(reading.model, 'Qwen2.5-Coder-7B-GGUF', 'the org prefix goes, the name stays');
});

test("the Artemis gateway's own shape is understood by the same probe", async () => {
  const fetchImpl = responder(() => new Response(JSON.stringify({ models: [{ id: 'artemis' }] })));
  assert.equal((await probeModels('https://api.example', undefined, fetchImpl)).model, 'artemis');
});

test('an HTTP error is unreachable with the status as the reason', async () => {
  const fetchImpl = responder(() => new Response('nope', { status: 503 }));
  const reading = await probeModels('http://localhost:1234', undefined, fetchImpl);
  assert.equal(reading.reachable, false);
  assert.equal(reading.detail, 'HTTP 503');
});

test('a refused connection is reported, not thrown', async () => {
  const fetchImpl = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  const reading = await probeModels('http://localhost:1234', undefined, fetchImpl);
  assert.equal(reading.reachable, false);
  assert.match(String(reading.detail), /fetch failed/);
});

test('a key is sent only when there is one', async () => {
  const seen: Record<string, unknown>[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    seen.push((init.headers ?? {}) as Record<string, unknown>);
    return new Response(JSON.stringify({ data: [] }));
  }) as unknown as typeof fetch;
  await probeModels('http://x', 'art-key', fetchImpl);
  await probeModels('http://x', undefined, fetchImpl);
  assert.equal(seen[0]?.Authorization, 'Bearer art-key');
  assert.ok(!('Authorization' in (seen[1] ?? {})));
});

// ------------------------------------------------------------------ GPU figures

const VLLM_METRICS = `# HELP vllm:gpu_cache_usage_perc GPU KV-cache usage
# TYPE vllm:gpu_cache_usage_perc gauge
vllm:gpu_cache_usage_perc{model_name="artemis"} 0.42
vllm:num_requests_running{model_name="artemis"} 3.0
vllm:num_requests_waiting{model_name="artemis"} 1.0
`;

test('vLLM gauges are read from the metrics endpoint', () => {
  assert.deepEqual(parsePrometheus(VLLM_METRICS), { gpuCache: 0.42, running: 3, queued: 1 });
});

test('a server without those gauges reports null, never zero', () => {
  // Zero would be drawn as an idle GPU, which is a different claim from "not told".
  assert.deepEqual(parsePrometheus('# nothing here\n'), { gpuCache: null, running: null, queued: null });
});

test('a metrics endpoint that is absent is not an error', async () => {
  const fetchImpl = responder(() => new Response('not found', { status: 404 }));
  assert.deepEqual(await probeGpu('http://localhost:1234', fetchImpl), { gpuCache: null, running: null, queued: null });
});

test('a full probe combines the model and the GPU figures', async () => {
  const fetchImpl = responder((url) =>
    url.endsWith('/metrics')
      ? new Response(VLLM_METRICS)
      : new Response(JSON.stringify({ data: [{ id: 'artemis-1b' }] })));
  const reading = await probeServer('http://gpu-vm:8000', undefined, fetchImpl);
  assert.deepEqual(reading, { reachable: true, model: 'artemis-1b', gpuCache: 0.42, running: 3, queued: 1 });
});

test('an unreachable server is not probed for GPU figures', async () => {
  let metricsCalls = 0;
  const fetchImpl = responder((url) => {
    if (url.endsWith('/metrics')) metricsCalls++;
    return new Response('down', { status: 502 });
  });
  const reading = await probeServer('http://gpu-vm:8000', undefined, fetchImpl);
  assert.equal(reading.reachable, false);
  assert.equal(metricsCalls, 0);
});

// ------------------------------------------------------------------ labels

test('a long model id is shortened from the tail, which is the useful part', () => {
  assert.equal(shortModel('org/Very-Long-Model-Name-Instruct-v2', 22), 'Very-Long-Model-Name-…');
  assert.equal(shortModel('artemis'), 'artemis');
});

test('the server label distinguishes a local port from a remote host', () => {
  assert.equal(serverLabel('http://localhost:1234'), 'local:1234');
  assert.equal(serverLabel('http://127.0.0.1:8000'), 'local:8000');
  assert.equal(serverLabel('https://gpu.example.com:8000'), 'gpu.example.com:8000');
});
