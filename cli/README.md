# artemis — the terminal client

Artemis is terminal-first: this CLI is a first-class surface, not a wrapper around
the website.

- **TypeScript on Bun.** `#!/usr/bin/env bun`; no build step, no bundler.
- **React + Ink, laid out by Yoga.** The UI is React components; Yoga gives
  flexbox in a terminal, so the transcript flexes and the composer stays pinned
  without arithmetic on rows.
- **Agentic search, not RAG.** No vector store, no embedding index, no retrieval
  pipeline. The model writes a glob or a regular expression and reads what comes
  back. Nothing to build, nothing stale after an edit, and the retrieval is
  legible: a vector hit is unfalsifiable, a grep result is a line number you can
  check.

It speaks `/v1`, which authenticates with an API key; `/api` is the website's
cookie-and-CSRF surface and is not meant for a terminal.

## Run it

```
npm run artemis -- "where is the retry logic?"
npm run artemis -- models
npm run artemis -- --help
```

Installed as a bin (`npm link`, or a published package), the same commands are
`artemis "…"`, `artemis models`, or `artemis` on its own for the full-screen UI.

## Settings

Settings live in `~/.artemis/config.json`, written owner-readable only (0600).

```
artemis config                 show them (the key is masked, never printed)
artemis config --url <url>     point at a different gateway
artemis config --key           store a key, taken from ARTEMIS_API_KEY
```

A key is never accepted as a command-line argument: argv is readable by other
users through `ps` and lands in shell history. To store one:

```
read -rs ARTEMIS_API_KEY && export ARTEMIS_API_KEY
artemis config --key
```

`ARTEMIS_BASE_URL`, `ARTEMIS_API_KEY` and `ARTEMIS_MODEL` override the file and
are never written to it, so CI can supply a key without leaving it on the runner.

## It is a pipeline stage, not just a prompt

The answer goes to stdout; the plan, tool activity, warnings and the third-party
notice go to stderr. So redirection yields the answer and nothing else:

```
artemis "write a commit message" > message.txt
cat notes.md | artemis "summarise this"
artemis --json models | jq -r '.models[] | select(.available).id'
```

Colour is written only to a TTY, and `NO_COLOR` turns it off everywhere.

Exit status: `0` success, `1` the request failed or Artemis is not serving,
`2` bad usage, `3` the gateway is unreachable. `artemis status` exits non-zero
when Artemis is not serving, so it works as a health check in a script.

## How it finds things

Each question starts a short loop, bounded at six rounds:

1. Artemis is told the working directory and the three tools below.
2. It replies with one fenced `search` block.
3. The CLI runs it locally and sends back the result.
4. It answers, citing `path:line`.

```
glob    {"pattern": "src/**/*.ts"}
grep    {"expression": "class \\w+", "pattern": "**/*.py", "ignore_case": true}
read    {"path": "cli/agent.ts", "offset": 1, "limit": 200}
```

Every search is printed as it happens, in the UI and on stderr under `--plain`.
`--no-search` turns the whole loop off.

Three bounds, because this runs on a real checkout:

- **Nothing outside the working directory is read.** Paths are resolved with
  `realpath` first, so `..`, an absolute path and a symlink pointing out of the
  tree are all refused. Nothing is ever written.
- **Noisy directories are skipped** — `.git`, `node_modules`, `dist` and friends —
  unless the pattern names one explicitly, so a question about a vendored package
  is still answerable.
- **Every result is capped.** An unbounded grep silently fills the context window
  and the model then answers from a truncated middle without knowing it.

The protocol deliberately does *not* reuse the gateway's `<tool_call>` markup: the
orchestrator owns that and runs those tools server-side, so a client tool written
that way never arrives.

## The status bar

Two rows. The first says what is answering; the second says how the server behind
it is doing, polled every five seconds.

```
╭──────────────────────────────────────────────────────────────────────────╮
│ Artemis  Artemis                       glob + grep  ~/work/cutline       │
│ ● Ready (artemis-1b)           ctx ~24% of 4096  kv 42%  gpu-vm:8000     │
╰──────────────────────────────────────────────────────────────────────────╯
```

| State | Colour | Reads |
| --- | --- | --- |
| Ready | `#10B981` | `Ready (<model>)` |
| Generating | `#3B82F6` | `Generating… 18.4 tok/s` |
| Context > 80% | `#F59E0B` | `Context ~85% (clear room)` |
| Disconnected | `#EF4444` | `Server disconnected — <reason>` |
| Checking | grey | before the first probe answers |

Every number is measured or marked as an estimate:

- **tok/s** is counted from the arrival of real stream chunks, timed from the
  *first* token rather than from the request. Including the wait for the first
  token gives a figure that climbs through the answer and settles nowhere, which
  says nothing about how fast the GPU is running. Time-to-first-token is kept
  separately.
- **ctx** carries a `~` because this process does not have the server's
  vocabulary. It uses the same four-characters-per-token rule the gateway bills
  with, so the two disagree in the same direction instead of contradicting.
- **kv** is vLLM's own `gpu_cache_usage_perc`. A server that does not publish it
  shows nothing at all — never `0%`, which would claim an idle GPU.
- Before the first probe answers the bar says *checking*, not *disconnected*.
  Announcing a dead server while still dialling it is a false alarm.

## Pointing it at a GPU server

The bar and the chat both speak the OpenAI shape, so the same terminal works
against the Artemis gateway, a vLLM server on a GPU host, or LM Studio locally:

```
artemis config --url http://localhost:1234     # LM Studio
artemis config --url http://localhost:8000     # vLLM over an SSH tunnel
artemis gpu                                    # what is actually back there
```

`infra/gpu/provision-gpu-vm.sh` stands up an Azure GPU VM running vLLM as a
systemd unit, bound to localhost and reached over an SSH tunnel — an open
inference port is an open wallet. It refuses to run while GPU quota is zero,
which it is on all three subscriptions as of 2026-10-10; the script says how to
request it.

## Models

`artemis models` lists what the plan includes, marks third-party models as such,
and greys out any the server has no credentials for. A third-party model
announces itself on stderr before it answers — a customer should never have to
ask who replied, and Artemis's own reasoning never calls one.

## Layout

| file | holds |
| --- | --- |
| `args.ts` | parsing, pure, fully tested |
| `glob.ts` | glob to regular expression |
| `search.ts` | glob, grep, read — bounded and confined to the working directory |
| `agent.ts` | the retrieval loop and its wire format |
| `ui/App.tsx` | the Ink UI: status bar, transcript, composer |
| `config.ts` | `~/.artemis/config.json`, permissions, key masking |
| `sse.ts` | incremental server-sent events, byte-wise so split characters survive |
| `client.ts` | the `/v1` calls and their errors |
| `render.ts` | stdout vs stderr, colour, meters, the third-party notice |
| `artemis.ts` | commands and the interactive session |

Typechecked under `cli/tsconfig.json` with `strict` and `noUncheckedIndexedAccess`
(stricter than the rest of the repo, since this is new code):
`npx tsc -p cli/tsconfig.json --noEmit`, and `tsc -b` covers it from the root.

`App.tsx` imports `React` by name although the project targets a modern JSX
runtime. tsx, Bun and tsc each default to a different transform and resolve
tsconfig differently; under the classic transform a missing `React` is not a
crash, because Ink catches the render error and paints it as the UI. Importing it
works under both transforms, so the UI does not depend on tool configuration.

Tests run on Node: `node --import tsx --test cli/*.test.ts cli/ui/*.test.tsx`.
