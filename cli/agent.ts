/**
 * The retrieval loop: the model asks, the CLI looks, the model reads the result.
 *
 * Context comes from globs and greps the MODEL writes, not from an index this program
 * built in advance. The server cannot do this — the files are on the user's machine —
 * so the loop lives here.
 *
 * It deliberately does NOT reuse the gateway's <tool_call> markup. The orchestrator owns
 * that: it strips the markup from the stream and runs the tool server-side, so a client
 * tool written that way never arrives and the user gets "unfinished tool call" instead of
 * an answer (observed against the real gateway). A fenced block passes through untouched
 * and reads as ordinary output if anything downstream does not understand it.
 *
 * Bounded on purpose: a loop that can call forever will, on some prompt, and the user
 * pays per round. ROUNDS caps it and the final round says so in the prompt, so the
 * model answers with what it has instead of asking for one more search.
 */
import { globFiles, grepFiles, readFileSlice } from './search.ts';

export const ROUNDS = 6;

export interface ToolCall { name: string; arguments: Record<string, unknown> }

export const TOOLS = `glob    {"pattern": "src/**/*.ts"}                      list files by name
grep    {"expression": "class \\\\w+", "pattern": "**/*.py", "ignore_case": true}  search contents
read    {"path": "cli/agent.ts", "offset": 1, "limit": 200}  read numbered lines`;

export function protocolPrompt(root: string): string {
  return [
    `You are answering a question about the files in ${root}. You can look at them.`,
    '',
    'To look, reply with ONLY a fenced block, nothing before or after it:',
    '```search',
    '{"name": "grep", "arguments": {"expression": "price", "pattern": "**/*.ts"}}',
    '```',
    '',
    'Tools:',
    TOOLS,
    '',
    'Search before answering; never guess at file contents. One search per reply.',
    'When you know the answer, reply with it in prose and no fenced block, citing',
    'what you found as path:line.',
  ].join('\n');
}

/**
 * Pulls a search request out of a reply, or null when the reply is the answer.
 *
 * Accepts the fence with or without its language tag, and a bare JSON object alone on
 * the reply, because models produce all three and refusing two of them would show the
 * user a block of JSON instead of an answer.
 */
export function parseToolCall(reply: string): ToolCall | { error: string } | null {
  const fenced = /```(?:search|json)?\s*\n([\s\S]*?)```/.exec(reply);
  const body = fenced ? (fenced[1] as string).trim() : bareObject(reply);
  if (!body) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { error: 'that search block was not valid JSON; send it again, exactly as shown' };
  }
  if (!parsed || typeof parsed !== 'object') return { error: 'a search block must be a JSON object' };
  const call = parsed as { name?: unknown; arguments?: unknown };
  if (typeof call.name !== 'string') return { error: 'a search block needs a "name"' };
  const args = call.arguments && typeof call.arguments === 'object' ? (call.arguments as Record<string, unknown>) : {};
  return { name: call.name, arguments: args };
}

/** A whole reply that is one JSON object: a search, not prose. */
function bareObject(reply: string): string | null {
  const text = reply.trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return null;
  return text.includes('"name"') ? text : null;
}

export interface ToolOutcome { summary: string; detail: string; ok: boolean }

/** Runs one call against the working tree. Never throws: the model reads the failure. */
export async function runTool(root: string, call: ToolCall): Promise<ToolOutcome> {
  const text = (key: string): string => (typeof call.arguments[key] === 'string' ? (call.arguments[key] as string) : '');
  const count = (key: string, fallback: number): number => {
    const value = call.arguments[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };
  try {
    if (call.name === 'glob') {
      const pattern = text('pattern') || '**/*';
      const files = await globFiles(root, pattern);
      return {
        ok: true,
        summary: `glob ${pattern} — ${files.length} file${files.length === 1 ? '' : 's'}`,
        detail: files.length ? files.join('\n') : 'no files matched',
      };
    }
    if (call.name === 'grep') {
      const expression = text('expression') || text('pattern');
      if (!expression) return { ok: false, summary: 'grep needs an expression', detail: 'grep needs an "expression"' };
      // When only one is given it is the expression, so the file glob falls back to everything.
      const files = text('expression') ? text('pattern') || '**/*' : '**/*';
      const hits = await grepFiles(root, expression, files, { ignoreCase: call.arguments.ignore_case === true });
      // A case-sensitive miss is the single most common dead end: the model greps
      // "price" and the code says MONTHLY_PRICE_USD, so it concludes the concept is
      // absent. Say what to try instead rather than letting it answer "not found".
      const insensitive = call.arguments.ignore_case === true;
      const empty = insensitive
        ? 'no matches'
        : 'no matches — this search was case-sensitive; retry with "ignore_case": true before concluding it is absent';
      return {
        ok: true,
        summary: `grep ${expression} in ${files} — ${hits.length} match${hits.length === 1 ? '' : 'es'}`,
        detail: hits.length ? hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join('\n') : empty,
      };
    }
    if (call.name === 'read') {
      const path = text('path');
      if (!path) return { ok: false, summary: 'read needs a path', detail: 'read needs a "path"' };
      const slice = await readFileSlice(root, path, count('offset', 1), count('limit', 400));
      const more = slice.to < slice.total ? `\n… ${slice.total - slice.to} more lines` : '';
      return { ok: true, summary: `read ${path} ${slice.from}-${slice.to} of ${slice.total}`, detail: slice.text + more };
    }
    return { ok: false, summary: `no tool called ${call.name}`, detail: `There is no tool called "${call.name}". Available:\n${TOOLS}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, summary: `${call.name} failed`, detail: message };
  }
}

export function resultMessage(call: ToolCall, outcome: ToolOutcome): string {
  return `Result of ${call.name}:\n${outcome.detail}`;
}

export function lastRoundNotice(): string {
  return 'No more searches are available. Answer now with what you have found, and say so if it is not enough.';
}
