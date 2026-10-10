#!/usr/bin/env bun
/**
 * The Artemis CLI: the terminal is the first-class surface, the website is one client.
 *
 * Design rules, all of them consequences of living in a terminal:
 *   - the answer goes to stdout, everything else to stderr, so redirection works;
 *   - stdin is read when it is piped, so Artemis composes with other tools;
 *   - a non-zero exit status on every failure, so scripts can branch on it;
 *   - the API key is never an argument and never printed.
 */
import { stdin, stdout } from 'node:process';

import { ROUNDS, lastRoundNotice, parseToolCall, protocolPrompt, resultMessage, runTool } from './agent.ts';
import { HELP, parseArgs, type Parsed } from './args.ts';
import { ArtemisError, Client, type ModelInfo } from './client.ts';
import { DEFAULT_BASE_URL, configPath, maskKey, readConfig, writeConfig, type Config } from './config.ts';
import { probeServer, serverLabel } from './server.ts';
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
    if (args.command === 'gpu') return await showGpu(settings, args, term);

    const piped = await readPipedInput();
    const prompt = [piped, args.prompt].filter(Boolean).join('\n\n').trim();
    const model = args.model ?? settings.model ?? 'artemis';

    // The full-screen UI needs a terminal to draw on and a keyboard to read. Piped
    // input or a redirected stdout means this is a pipeline stage, so fall back to
    // line output rather than painting frames into a file.
    const interactiveTerminal = stdout.isTTY === true && stdin.isTTY === true;
    if (!args.plain && !args.json && interactiveTerminal) {
      return await runInk(client, { ...args, prompt }, model, settings);
    }
    if (!prompt) {
      term.err('No prompt, and this is not an interactive terminal.\n');
      return 2;
    }
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

/**
 * What is actually behind the terminal. Points at whatever ARTEMIS_BASE_URL is: the
 * Artemis gateway, a vLLM server on a GPU VM, or LM Studio on this machine.
 *
 * Reports only what the server published. A server that does not expose GPU figures
 * is shown as not reporting them, never as a GPU sitting idle at zero.
 */
async function showGpu(settings: Config, args: Parsed, term: Term): Promise<number> {
  const reading = await probeServer(settings.baseUrl, settings.apiKey);
  if (args.json) { term.out(JSON.stringify({ server: settings.baseUrl, ...reading }, null, 2) + '\n'); return reading.reachable ? 0 : 1; }
  term.out(`server     ${serverLabel(settings.baseUrl)}\n`);
  term.out(`reachable  ${reading.reachable ? 'yes' : `no${reading.detail ? ` (${reading.detail})` : ''}`}\n`);
  if (!reading.reachable) {
    term.err('\nPoint the terminal at a server with: artemis config --url <url>\n' +
             'A vLLM server on a GPU host and LM Studio on this machine both work.\n');
    return 1;
  }
  term.out(`model      ${reading.model || 'none loaded'}\n`);
  if (reading.gpuCache === null) {
    term.out('gpu        not reported by this server\n');
    term.err('\nGPU figures come from a vLLM /metrics endpoint. The Artemis gateway and\n' +
             'LM Studio do not publish one, so there is nothing to read here.\n');
  } else {
    term.out(`kv cache   ${Math.round(reading.gpuCache * 100)}%\n`);
    if (reading.running !== null) term.out(`running    ${reading.running}\n`);
    if (reading.queued !== null) term.out(`queued     ${reading.queued}\n`);
  }
  return 0;
}

async function askOnce(client: Client, prompt: string, args: Parsed, fallback: string | undefined, term: Term): Promise<number> {
  const model = args.model ?? fallback;
  await announce(client, model, term);
  const writer = new AnswerWriter(term);
  let failure: string | undefined;
  const root = process.cwd();
  const thread: { role: 'user' | 'assistant'; content: string }[] = [];
  let message = args.search ? `${protocolPrompt(root)}\n\nQuestion: ${prompt}` : prompt;

  // The same retrieval loop the UI runs, so --plain is not a lesser Artemis. Search
  // activity goes to stderr; only the answer reaches stdout.
  for (let round = 0; round < (args.search ? ROUNDS : 1); round++) {
    const reply = new AnswerWriter({ out: () => {}, err: () => {}, colour: false });
    const sink = args.search ? reply : writer;
    for await (const event of client.stream({ message, model, brain: args.brain, tier: args.tier, history: thread })) {
      sink.handle(event);
      if (event.type === 'error' || event.type === 'training') failure = String(event.message ?? 'Artemis could not answer.');
    }
    if (failure) break;
    if (!args.search) break;
    const call = parseToolCall(reply.answer);
    if (!call) { writer.handle({ type: 'done', answer: reply.answer }); break; }
    if ('error' in call) { message = call.error; continue; }
    const outcome = await runTool(root, call);
    term.err(style(term, 'dim', `${outcome.ok ? '·' : '×'} ${outcome.summary}`) + '\n');
    thread.push({ role: 'user', content: message }, { role: 'assistant', content: reply.answer });
    message = resultMessage(call, outcome);
    if (round === ROUNDS - 2) message += '\n\n' + lastRoundNotice();
  }
  if (args.json) { term.out(JSON.stringify({ answer: writer.answer, model: model ?? 'artemis' }, null, 2) + '\n'); return failure ? 1 : 0; }
  if (failure) { term.err('\n' + style(term, 'red', failure) + '\n'); return 1; }
  if (writer.answer && !writer.answer.endsWith('\n')) term.out('\n');
  return 0;
}

/** Hands over to the Ink UI: React components, Yoga layout, one full-screen app. */
async function runInk(client: Client, args: Parsed, modelId: string, settings: Config): Promise<number> {
  // Imported here, not at the top: `artemis models` in a script should not pay to
  // load React, a reconciler and a WASM layout engine.
  const [{ render }, { App }, { createElement }] = await Promise.all([
    import('ink'),
    import('./ui/App.tsx'),
    import('react'),
  ]);
  let model: ModelInfo | undefined;
  try {
    model = (await client.models()).find((m) => m.id === modelId);
  } catch {
    // Offline or unauthorised: the first question will report it properly.
  }
  const app = render(createElement(App, {
    client,
    model,
    modelId,
    root: process.cwd(),
    search: args.search,
    baseUrl: settings.baseUrl,
    ...(settings.apiKey ? { apiKey: settings.apiKey } : {}),
    contextLimit: settings.contextTokens ?? 4096,
    ...(args.prompt ? { initialPrompt: args.prompt } : {}),
  }));
  await app.waitUntilExit();
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
