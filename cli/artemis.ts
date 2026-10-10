#!/usr/bin/env -S node --import tsx
/**
 * The Artemis CLI: the terminal is the first-class surface, the website is one client.
 *
 * Design rules, all of them consequences of living in a terminal:
 *   - the answer goes to stdout, everything else to stderr, so redirection works;
 *   - stdin is read when it is piped, so Artemis composes with other tools;
 *   - a non-zero exit status on every failure, so scripts can branch on it;
 *   - the API key is never an argument and never printed.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { HELP, parseArgs, type Parsed } from './args.ts';
import { ArtemisError, Client, type ModelInfo } from './client.ts';
import { DEFAULT_BASE_URL, configPath, maskKey, readConfig, writeConfig } from './config.ts';
import { AnswerWriter, externalBanner, renderModels, style, terminal, type Term } from './render.ts';

export const VERSION = '0.1.0';

export async function main(argv: string[] = process.argv.slice(2), term: Term = terminal()): Promise<number> {
  const args = parseArgs(argv);
  if (args.error) {
    term.err(style(term, 'red', args.error) + '\n');
    return 2;
  }
  if (args.command === 'help') { term.out(HELP + '\n'); return 0; }
  if (args.command === 'version') { term.out(VERSION + '\n'); return 0; }
  if (args.command === 'config') return config(args, term);

  const settings = readConfig();
  const client = new Client(settings);
  try {
    if (args.command === 'models') return await listModels(client, settings.model ?? 'artemis', args, term);
    if (args.command === 'status') return await showStatus(client, args, term);

    const piped = await readPipedInput();
    const prompt = [piped, args.prompt].filter(Boolean).join('\n\n').trim();
    if (!prompt) return await interactive(client, args, settings.model, term);
    return await askOnce(client, prompt, args, settings.model, term);
  } catch (error) {
    return fail(error, term);
  }
}

// ------------------------------------------------------------------ commands

function config(args: Parsed, term: Term): number {
  if (args.setUrl) {
    const saved = writeConfig({ baseUrl: args.setUrl });
    term.err(`gateway set to ${saved.baseUrl}\n`);
  }
  if (args.setKey) {
    const key = process.env.ARTEMIS_API_KEY;
    if (!key) {
      term.err('Set ARTEMIS_API_KEY in your shell and re-run, so the key never reaches\n' +
               'your shell history:\n\n  read -rs ARTEMIS_API_KEY && export ARTEMIS_API_KEY\n  artemis config --key\n');
      return 2;
    }
    writeConfig({ apiKey: key });
    term.err(`key stored in ${configPath()} (owner-readable only)\n`);
  }
  const current = readConfig();
  const shown = { path: configPath(), baseUrl: current.baseUrl, apiKey: maskKey(current.apiKey), model: current.model ?? 'artemis' };
  if (args.json) { term.out(JSON.stringify(shown, null, 2) + '\n'); return 0; }
  for (const [key, value] of Object.entries(shown)) term.out(`${key.padEnd(8)} ${value}\n`);
  if (current.baseUrl === DEFAULT_BASE_URL && !current.apiKey) {
    term.err('\nNo key set, so requests are anonymous and on the free plan.\n');
  }
  return 0;
}

async function listModels(client: Client, current: string, args: Parsed, term: Term): Promise<number> {
  const models = await client.models();
  if (args.json) { term.out(JSON.stringify({ models }, null, 2) + '\n'); return 0; }
  if (!models.length) { term.err('No models available on this plan.\n'); return 1; }
  term.out(renderModels(term, models, current) + '\n');
  return 0;
}

async function showStatus(client: Client, args: Parsed, term: Term): Promise<number> {
  const status = await client.status();
  if (args.json) { term.out(JSON.stringify(status, null, 2) + '\n'); return 0; }
  for (const [key, value] of Object.entries(status)) {
    if (value !== null && typeof value === 'object') continue;
    term.out(`${key.padEnd(10)} ${String(value)}\n`);
  }
  // Availability is not a quality claim, and a bootstrap backend is not Artemis.
  if (status.quality === 'not-artemis') {
    term.err(style(term, 'yellow', 'Serving a bootstrap model, not Artemis\'s own weights.') + '\n');
  }
  return status.serving === true ? 0 : 1;
}

async function askOnce(client: Client, prompt: string, args: Parsed, fallback: string | undefined, term: Term): Promise<number> {
  const model = args.model ?? fallback;
  await announce(client, model, term);
  const writer = new AnswerWriter(term);
  let failure: string | undefined;
  for await (const event of client.stream({ message: prompt, model, brain: args.brain, tier: args.tier })) {
    writer.handle(event);
    if (event.type === 'error' || event.type === 'training') failure = String(event.message ?? 'Artemis could not answer.');
  }
  if (args.json) { term.out(JSON.stringify({ answer: writer.answer, model: model ?? 'artemis' }, null, 2) + '\n'); return failure ? 1 : 0; }
  if (failure) { term.err('\n' + style(term, 'red', failure) + '\n'); return 1; }
  if (writer.answer && !writer.answer.endsWith('\n')) term.out('\n');
  return 0;
}

async function interactive(client: Client, args: Parsed, fallback: string | undefined, term: Term): Promise<number> {
  const model = args.model ?? fallback;
  await announce(client, model, term);
  term.err(style(term, 'dim', 'Artemis. Ctrl-D or /exit to leave, /model <id> to switch.') + '\n');
  const rl = createInterface({ input: stdin, output: stdout });
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let current = model;
  try {
    for (;;) {
      const line = (await rl.question(style(term, 'cyan', '› '))).trim();
      if (!line) continue;
      if (line === '/exit' || line === '/quit') break;
      if (line.startsWith('/model')) {
        current = line.split(/\s+/)[1] || current;
        await announce(client, current, term);
        continue;
      }
      const writer = new AnswerWriter(term);
      try {
        for await (const event of client.stream({ message: line, model: current, brain: args.brain, tier: args.tier, history })) {
          writer.handle(event);
          if (event.type === 'error' || event.type === 'training') term.err('\n' + style(term, 'red', String(event.message ?? 'Artemis could not answer.')) + '\n');
        }
        term.out('\n\n');
        // Only a real exchange is remembered, so a failed turn cannot poison the context.
        if (writer.answer) history.push({ role: 'user', content: line }, { role: 'assistant', content: writer.answer });
      } catch (error) {
        fail(error, term);   // one bad turn should not end the session
      }
    }
  } catch {
    // Ctrl-D closes the stream; that is a normal exit, not a failure
  } finally {
    rl.close();
  }
  return 0;
}

// ------------------------------------------------------------------ helpers

/** States plainly when a third-party model is about to answer. Never silently. */
async function announce(client: Client, model: string | undefined, term: Term): Promise<void> {
  if (!model || model === 'artemis') return;
  let models: ModelInfo[] = [];
  try {
    models = await client.models();
  } catch {
    return;   // the chat request will report the real problem
  }
  externalBanner(term, models.find((m) => m.id === model));
}

async function readPipedInput(): Promise<string> {
  if (stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function fail(error: unknown, term: Term): number {
  if (error instanceof ArtemisError) {
    term.err(style(term, 'red', error.message) + '\n');
    if (error.upgrade) term.err(`See your plan: ${error.upgrade}\n`);
    return error.status === 0 ? 3 : 1;
  }
  term.err(style(term, 'red', error instanceof Error ? error.message : String(error)) + '\n');
  return 1;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('artemis.ts') || entry.endsWith('artemis')) {
  main().then((code) => { process.exitCode = code; });
}
