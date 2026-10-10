/**
 * The Artemis terminal UI: React components, rendered by Ink, laid out by Yoga.
 *
 * Yoga gives flexbox in a terminal, so the transcript can flex and the composer stay
 * pinned without arithmetic on rows. The parts worth knowing:
 *
 *   - the transcript is a plain list of finished turns plus one live turn, so a
 *     streaming answer is one re-rendered node rather than a growing list;
 *   - every retrieval the model drives shows up as a line the user can read, because
 *     the whole point of globs over embeddings is that the retrieval is legible;
 *   - a third-party model is named in the status bar for as long as it is selected.
 */
import { Box, Text, useApp, useInput } from 'ink';
// React is imported by name on purpose. tsx, Bun and tsc each default to a different
// JSX transform and resolve tsconfig differently, and under the classic transform an
// absent React is not a crash: Ink catches the render error and paints it as the UI.
// Importing it works under both transforms, so the UI cannot depend on tool config.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import type { Client, ModelInfo } from '../client.ts';
import { ROUNDS, lastRoundNotice, parseToolCall, protocolPrompt, resultMessage, runTool } from '../agent.ts';
import { short } from '../render.ts';

export interface Step { summary: string; ok: boolean }

export interface Turn {
  id: number;
  question: string;
  answer: string;
  steps: Step[];
  state: 'thinking' | 'done' | 'failed';
  error?: string;
}

export interface AppProps {
  client: Client;
  model: ModelInfo | undefined;
  modelId: string;
  root: string;
  search: boolean;
  initialPrompt?: string;
}

export function App({ client, model, modelId, root, search, initialPrompt }: AppProps): ReactElement {
  const { exit } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const history = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  const ask = useCallback(async (question: string) => {
    const id = nextId.current++;
    setTurns((all) => [...all, { id, question, answer: '', steps: [], state: 'thinking' }]);
    const patch = (change: Partial<Turn>) =>
      setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)));

    let answer = '';
    const steps: Step[] = [];
    // One conversation per question: the retrieval rounds are internal detail, so only
    // the question and the final answer join the history the next question sees.
    const thread = [...history.current];
    let message = search ? `${protocolPrompt(root)}\n\nQuestion: ${question}` : question;

    try {
      for (let round = 0; round < (search ? ROUNDS : 1); round++) {
        answer = '';
        for await (const event of client.stream({ message, model: modelId, history: thread })) {
          if (event.type === 'token' && typeof event.text === 'string') {
            answer += event.text;
            patch({ answer });
          } else if (event.type === 'replace' && typeof event.text === 'string') {
            answer = event.text;
            patch({ answer });
          } else if (event.type === 'error' || event.type === 'training') {
            patch({ state: 'failed', error: String(event.message ?? 'Artemis could not answer.') });
            return;
          }
        }
        const call = search ? parseToolCall(answer) : null;
        if (!call) break;
        if ('error' in call) {
          message = call.error;
          continue;
        }
        const outcome = await runTool(root, call);
        steps.push({ summary: outcome.summary, ok: outcome.ok });
        patch({ steps: [...steps], answer: '' });
        thread.push({ role: 'user', content: message }, { role: 'assistant', content: answer });
        message = resultMessage(call, outcome);
        if (round === ROUNDS - 2) message += '\n\n' + lastRoundNotice();
      }
      patch({ answer, state: 'done' });
      history.current.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
    } catch (error) {
      patch({ state: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }, [client, modelId, root, search]);

  useEffect(() => {
    if (!initialPrompt) return;
    setBusy(true);
    void ask(initialPrompt).finally(() => setBusy(false));
  }, [initialPrompt, ask]);

  const submit = useCallback((question: string) => {
    const text = question.trim();
    if (!text) return;
    if (text === '/exit' || text === '/quit') { exit(); return; }
    setDraft('');
    setBusy(true);
    void ask(text).finally(() => setBusy(false));
  }, [ask, exit]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') { exit(); return; }
    if (busy) return;
    // A terminal delivers a paste as ONE chunk, so the newline arrives inside `input`
    // and key.return is false. Checking only key.return swallows the newline into the
    // draft and the line is never sent — the UI looks frozen. Split on it instead.
    const text = input ?? '';
    if (key.return || /[\r\n]/.test(text)) {
      const [head = ''] = text.split(/[\r\n]/);
      submit(draft + head);
      return;
    }
    if (key.backspace || key.delete) { setDraft((d) => d.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && text) setDraft((d) => d + text);
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <StatusBar model={model} modelId={modelId} root={root} search={search} />
      <Box flexDirection="column" marginTop={1}>
        {turns.map((turn) => <TurnView key={turn.id} turn={turn} />)}
      </Box>
      {!initialPrompt && <Composer draft={draft} busy={busy} />}
    </Box>
  );
}

export function StatusBar({ model, modelId, root, search }: { model: ModelInfo | undefined; modelId: string; root: string; search: boolean }): ReactElement {
  const external = model?.external === true;
  return (
    <Box borderStyle="round" borderColor={external ? 'yellow' : 'cyan'} paddingX={1} justifyContent="space-between">
      <Text>
        <Text bold color={external ? 'yellow' : 'cyan'}>{model?.display ?? modelId}</Text>
        {external
          ? <Text color="yellow">{`  not Artemis · requests leave Artemis (${model?.provider})`}</Text>
          : <Text dimColor>  Artemis</Text>}
      </Text>
      <Text dimColor>{search ? 'glob + grep' : 'no file access'}  {short(root)}</Text>
    </Box>
  );
}

function TurnView({ turn }: { turn: Turn }): ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">› {turn.question}</Text>
      {turn.steps.map((step, i) => (
        <Text key={i} dimColor>  {step.ok ? '·' : '×'} {step.summary}</Text>
      ))}
      {turn.state === 'failed'
        ? <Text color="red">  {turn.error}</Text>
        : <Text>{turn.answer || (turn.state === 'thinking' ? <Text dimColor>  …</Text> : '')}</Text>}
    </Box>
  );
}

function Composer({ draft, busy }: { draft: string; busy: boolean }): ReactElement {
  return (
    <Box>
      <Text color={busy ? 'gray' : 'cyan'}>{busy ? '… ' : '› '}</Text>
      <Text>{draft}</Text>
      {!busy && <Text inverse> </Text>}
    </Box>
  );
}
