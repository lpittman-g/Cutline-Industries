/**
 * Server-sent events, parsed incrementally.
 *
 * Kept separate from the transport so it can be tested without a socket, and written
 * byte-wise rather than line-wise: a multi-byte character split across two chunks is
 * the normal case on a slow connection, and decoding each chunk on its own corrupts it.
 */

export interface ServerEvent {
  type: string;
  [key: string]: unknown;
}

/** Feeds raw chunks in, calls back once per complete event. */
export class EventParser {
  readonly #decoder = new TextDecoder();
  readonly #onEvent: (event: ServerEvent) => void;
  #buffer = '';
  #data: string[] = [];

  constructor(onEvent: (event: ServerEvent) => void) {
    this.#onEvent = onEvent;
  }

  push(chunk: Uint8Array): void {
    this.#buffer += this.#decoder.decode(chunk, { stream: true });
    this.#drain();
  }

  /** Call once the body ends: flushes a trailing event that had no blank line after it. */
  end(): void {
    this.#buffer += this.#decoder.decode();
    this.#drain();
    this.#line('');
  }

  #drain(): void {
    for (let i = this.#buffer.indexOf('\n'); i >= 0; i = this.#buffer.indexOf('\n')) {
      this.#line(this.#buffer.slice(0, i));
      this.#buffer = this.#buffer.slice(i + 1);
    }
  }

  #line(raw: string): void {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') {
      if (!this.#data.length) return;
      const payload = this.#data.join('\n');
      this.#data = [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return; // a malformed frame is not worth killing a live answer over
      }
      if (parsed && typeof parsed === 'object' && typeof (parsed as ServerEvent).type === 'string') {
        this.#onEvent(parsed as ServerEvent);
      }
      return;
    }
    // "event:" names the type, but every Artemis event carries its own `type` field,
    // so only the data lines matter here.
    if (line.startsWith('data:')) this.#data.push(line.slice(5).replace(/^ /, ''));
  }
}
