/**
 * What the status bar knows.
 *
 * Every number here is measured, not guessed. Tokens per second comes from arrival
 * times of real stream chunks; context use is an explicit ESTIMATE and is labelled as
 * one, because the server tokenises with a vocabulary this process does not have. A
 * status bar that invents numbers is worse than one that admits it cannot tell.
 */

export type ServerState = 'ready' | 'generating' | 'context' | 'offline' | 'unknown';

/** The palette the states are specified in. Ink accepts hex directly. */
export const STATE_COLOUR: Record<ServerState, string> = {
  ready: '#10B981',
  generating: '#3B82F6',
  context: '#F59E0B',
  offline: '#EF4444',
  unknown: '#6B7280',
};

export const STATE_MARK: Record<ServerState, string> = {
  ready: '●', generating: '◍', context: '▲', offline: '■', unknown: '○',
};

/** Context is called full at this share, which is when answers start getting clipped. */
export const CONTEXT_WARN = 0.8;

/**
 * Four characters per token: the same rough rule the gateway bills with, so the bar
 * and the server disagree in the same direction rather than contradicting each other.
 */
export function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function contextShare(usedTokens: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.min(1, usedTokens / limit);
}

/**
 * Measures generation speed from chunk arrivals.
 *
 * The rate is taken from the FIRST token onward, not from when the request was sent:
 * including the wait for the first token reports a number that climbs through the
 * answer and settles nowhere, which tells the user nothing about the GPU.
 */
export class TokenMeter {
  #tokens = 0;
  #firstAt: number | null = null;
  #lastAt = 0;
  #queueMs = 0;

  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  /** Call once per streamed chunk. */
  record(text: string, startedAt?: number): void {
    const at = this.#now();
    if (this.#firstAt === null) {
      this.#firstAt = at;
      if (startedAt !== undefined) this.#queueMs = Math.max(0, at - startedAt);
    }
    this.#lastAt = at;
    this.#tokens += approxTokens(text);
  }

  reset(): void {
    this.#tokens = 0;
    this.#firstAt = null;
    this.#lastAt = 0;
    this.#queueMs = 0;
  }

  get tokens(): number { return this.#tokens; }

  /** Milliseconds from sending to the first token: queueing and prompt processing. */
  get firstTokenMs(): number { return this.#queueMs; }

  /** Tokens per second, or null before there is enough to divide by. */
  get rate(): number | null {
    if (this.#firstAt === null) return null;
    const seconds = (this.#lastAt - this.#firstAt) / 1000;
    if (seconds < 0.25 || this.#tokens < 2) return null;   // too short to mean anything
    return this.#tokens / seconds;
  }
}

export interface Reading {
  state: ServerState;
  /** Tokens per second while generating, null when not measurable yet. */
  rate: number | null;
  contextUsed: number;
  contextLimit: number;
  model: string;
  server: string;
  detail?: string;
}

/** The one line a status bar shows, derived from a reading. Pure, so it is testable. */
export function statusText(reading: Reading): string {
  const share = contextShare(reading.contextUsed, reading.contextLimit);
  if (reading.state === 'offline') return `Server disconnected${reading.detail ? ` — ${reading.detail}` : ''}`;
  if (reading.state === 'unknown') return 'Checking server…';
  if (reading.state === 'generating') {
    return reading.rate === null ? 'Generating…' : `Generating… ${reading.rate.toFixed(1)} tok/s`;
  }
  if (share >= CONTEXT_WARN) return `Context ~${Math.round(share * 100)}% (clear room)`;
  return `Ready (${reading.model})`;
}

/** The state a reading implies, given whether a request is in flight. */
export function deriveState(
  reachable: boolean | null,
  generating: boolean,
  contextUsed: number,
  contextLimit: number,
): ServerState {
  if (reachable === null) return 'unknown';
  if (!reachable) return 'offline';
  if (generating) return 'generating';
  return contextShare(contextUsed, contextLimit) >= CONTEXT_WARN ? 'context' : 'ready';
}
