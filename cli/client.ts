/**
 * Talking to the Artemis gateway.
 *
 * Only /v1 is used: those routes authenticate with an API key, where the /api routes
 * are the website's own cookie-and-CSRF surface and are not meant for a terminal.
 */
import { EventParser, type ServerEvent } from './sse.ts';
import type { Config } from './config.ts';

export interface ModelInfo {
  id: string;
  display: string;
  provider: string;
  external: boolean;
  available: boolean;
  description?: string;
}

export interface ChatRequest {
  message: string;
  model?: string;
  tier?: string;
  brain?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export class ArtemisError extends Error {
  readonly status: number;
  readonly upgrade: string | undefined;

  constructor(message: string, status: number, upgrade?: string) {
    super(message);
    this.name = 'ArtemisError';
    this.status = status;
    this.upgrade = upgrade;
  }
}

export class Client {
  readonly #config: Config;
  readonly #fetch: typeof fetch;

  constructor(config: Config, fetchImpl: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchImpl;
  }

  #headers(body: boolean): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(this.#config.apiKey ? { Authorization: `Bearer ${this.#config.apiKey}` } : {}),
    };
  }

  async #request(path: string, init?: { method?: string; body?: unknown }): Promise<Response> {
    const url = new URL(path, this.#config.baseUrl).toString();
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: init?.method ?? 'GET',
        headers: this.#headers(init?.body !== undefined),
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (cause) {
      const reason = cause instanceof Error ? ` (${cause.message})` : '';
      throw new ArtemisError(`Cannot reach Artemis at ${this.#config.baseUrl}.${reason}`, 0);
    }
    if (!response.ok) throw await readError(response);
    return response;
  }

  async json<T>(path: string): Promise<T> {
    return (await this.#request(path)).json() as Promise<T>;
  }

  async models(): Promise<ModelInfo[]> {
    const body = await this.json<{ models?: ModelInfo[] }>('/v1/models');
    return body.models ?? [];
  }

  async status(): Promise<Record<string, unknown>> {
    return this.json('/v1/status');
  }

  /** Streams one answer. Yields the events the server sends, in order. */
  async *stream(request: ChatRequest): AsyncGenerator<ServerEvent> {
    const response = await this.#request('/v1/chat/stream', { method: 'POST', body: request });
    if (!response.body) throw new ArtemisError('Artemis sent no response body.', 502);

    // The parser is push-driven and this is a generator, so events queue between reads.
    const queue: ServerEvent[] = [];
    const parser = new EventParser((event) => queue.push(event));
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (value) parser.push(value);
        if (done) parser.end();
        while (queue.length) yield queue.shift() as ServerEvent;
        if (done) return;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

async function readError(response: Response): Promise<ArtemisError> {
  let message = `Artemis returned ${response.status}.`;
  let upgrade: string | undefined;
  try {
    const body = (await response.json()) as { error?: unknown; upgrade?: unknown };
    if (typeof body.error === 'string' && body.error) message = body.error;
    if (typeof body.upgrade === 'string') upgrade = body.upgrade;
  } catch {
    // a non-JSON error page: the status line is all we can honestly report
  }
  if (response.status === 401) message += ' Set a key with: artemis config --key';
  return new ArtemisError(message, response.status, upgrade);
}
