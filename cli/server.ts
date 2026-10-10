/**
 * Watching the inference server behind the terminal.
 *
 * The same OpenAI-shaped probe reaches Artemis's gateway, a vLLM server on a GPU VM
 * and LM Studio on a laptop, so one status bar covers all three. Only what a server
 * actually reports is shown: GPU figures come from vLLM's Prometheus endpoint when it
 * has one, and otherwise are reported as unavailable rather than invented.
 */

export interface ServerReading {
  reachable: boolean;
  model: string;
  /** Share of the KV cache in use, 0..1, when the server publishes it. */
  gpuCache: number | null;
  running: number | null;
  queued: number | null;
  detail?: string;
}

const UNREACHED: ServerReading = { reachable: false, model: '', gpuCache: null, running: null, queued: null };

/** GET /v1/models, the one endpoint every OpenAI-compatible server answers. */
export async function probeModels(
  baseUrl: string,
  apiKey?: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<{ reachable: boolean; model: string; detail?: string }> {
  try {
    const response = await fetchImpl(new URL('/v1/models', baseUrl).toString(), {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { reachable: false, model: '', detail: `HTTP ${response.status}` };
    const body = (await response.json()) as { data?: { id?: unknown }[]; models?: { id?: unknown }[] };
    // vLLM and LM Studio answer {data:[{id}]}; the Artemis gateway answers {models:[{id}]}.
    const list = body.data ?? body.models ?? [];
    const first = list[0]?.id;
    return { reachable: true, model: typeof first === 'string' ? shortModel(first) : '' };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return { reachable: false, model: '', detail: detail.includes('timed out') ? 'timed out' : detail };
  }
}

/**
 * vLLM publishes Prometheus metrics; LM Studio does not. Absent or unparsable means
 * null, never zero: zero would be drawn as an empty GPU, which is a different claim.
 */
export async function probeGpu(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<Pick<ServerReading, 'gpuCache' | 'running' | 'queued'>> {
  try {
    const response = await fetchImpl(new URL('/metrics', baseUrl).toString(), { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { gpuCache: null, running: null, queued: null };
    return parsePrometheus(await response.text());
  } catch {
    return { gpuCache: null, running: null, queued: null };
  }
}

/** Reads the three vLLM gauges worth putting in a status bar. */
export function parsePrometheus(text: string): Pick<ServerReading, 'gpuCache' | 'running' | 'queued'> {
  const read = (name: string): number | null => {
    // Lines look like: vllm:num_requests_running{model_name="x"} 3.0
    const match = new RegExp(`^${name}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`, 'm').exec(text);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  };
  return {
    gpuCache: read('vllm:gpu_cache_usage_perc'),
    running: read('vllm:num_requests_running'),
    queued: read('vllm:num_requests_waiting'),
  };
}

export async function probeServer(
  baseUrl: string,
  apiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ServerReading> {
  const models = await probeModels(baseUrl, apiKey, fetchImpl);
  if (!models.reachable) return { ...UNREACHED, ...(models.detail ? { detail: models.detail } : {}) };
  const gpu = await probeGpu(baseUrl, fetchImpl);
  return { reachable: true, model: models.model, ...gpu };
}

/** "lmstudio-community/Qwen2.5-Coder-7B-GGUF" is unreadable in a bar; the tail is not. */
export function shortModel(id: string, max = 22): string {
  const tail = id.split('/').pop() ?? id;
  return tail.length <= max ? tail : tail.slice(0, max - 1) + '…';
}

/** Where the terminal is pointed, for the bar's right-hand label. */
export function serverLabel(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return local ? `local:${url.port || '80'}` : url.host;
  } catch {
    return baseUrl;
  }
}
