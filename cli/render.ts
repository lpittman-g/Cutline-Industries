/**
 * Terminal output.
 *
 * Two rules, both from the fact that a terminal program is also a pipeline stage:
 * colour and progress go to a TTY only, and anything a script would want to consume
 * goes to stdout while status and warnings go to stderr. `artemis "q" > out.txt`
 * must leave out.txt holding the answer and nothing else.
 */
import type { ServerEvent } from './sse.ts';
import type { ModelInfo } from './client.ts';

export interface Term {
  out: (text: string) => void;
  err: (text: string) => void;
  colour: boolean;
}

export function terminal(): Term {
  // NO_COLOR is the agreed opt-out; a redirected stdout is never coloured either.
  const colour = process.stdout.isTTY === true && !process.env.NO_COLOR;
  return {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
    colour,
  };
}

const CODES: Record<string, string> = { dim: '2', bold: '1', red: '31', yellow: '33', cyan: '36' };

export function style(term: Term, name: keyof typeof CODES | string, text: string): string {
  if (!term.colour || !CODES[name]) return text;
  return `\u001b[${CODES[name]}m${text}\u001b[0m`;
}

/**
 * A third-party model answering is stated before its first token, on stderr so it
 * survives redirection of the answer. A customer should never have to ask who replied.
 */
export function externalBanner(term: Term, model: ModelInfo | undefined): void {
  if (!model?.external) return;
  // Worded as a property of the selection, not of a completed send: the request may
  // still fail, and claiming data left when it did not is its own kind of lie.
  term.err(style(term, 'yellow', `${model.display} (${model.provider}) — not Artemis. Requests to this model leave Artemis.`) + '\n');
}

export function renderModels(term: Term, models: ModelInfo[], current: string): string {
  const width = Math.max(...models.map((m) => m.id.length), 5);
  return models
    .map((m) => {
      const marks = [m.external ? 'third party' : 'our own model', m.available ? '' : 'unavailable']
        .filter(Boolean)
        .join(' · ');
      const line = `${m.id === current ? '*' : ' '} ${m.id.padEnd(width)}  ${m.display}  ${style(term, 'dim', marks)}`;
      return m.available ? line : style(term, 'dim', line);
    })
    .join('\n');
}

/** Consumes a stream of events, writing the answer to stdout and everything else to stderr. */
export class AnswerWriter {
  readonly #term: Term;
  #answer = '';
  #wroteTokens = false;

  constructor(term: Term) {
    this.#term = term;
  }

  get answer(): string {
    return this.#answer;
  }

  handle(event: ServerEvent): void {
    switch (event.type) {
      case 'token': {
        const text = typeof event.text === 'string' ? event.text : '';
        this.#answer += text;
        this.#wroteTokens = true;
        this.#term.out(text);
        break;
      }
      case 'replace': {
        // The audit rejected the streamed answer. Say so: silently swapping the text
        // under a reader who already started reading it is worse than a visible redo.
        const text = typeof event.text === 'string' ? event.text : '';
        this.#answer = text;
        this.#term.err('\n' + style(this.#term, 'dim', '— revised after review —') + '\n');
        this.#term.out(text);
        break;
      }
      case 'tool_call':
        this.#term.err(style(this.#term, 'dim', `· ${String(event.name)} running`) + '\n');
        break;
      case 'tool_result':
        this.#term.err(style(this.#term, 'dim', `· ${String(event.name)} ${event.ok ? 'done' : 'failed'}`) + '\n');
        break;
      case 'done': {
        const final = typeof event.answer === 'string' ? event.answer : this.#answer;
        if (!this.#wroteTokens && final) this.#term.out(final);
        this.#answer = final;
        break;
      }
      default:
        break;
    }
  }
}

/** Keeps a deep path from pushing a status line wider than the terminal. */
export function short(path: string, max = 36): string {
  if (path.length <= max) return path;
  return '…' + path.slice(path.length - max + 1);
}
