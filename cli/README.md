# artemis — the terminal client

Artemis is terminal-first: this CLI is a first-class surface, not a wrapper around
the website. It speaks only the `/v1` API, which authenticates with an API key;
the `/api` routes are the website's cookie-and-CSRF surface and are not meant for
a terminal.

## Run it

```
npm run artemis -- "what changed in this repo today?"
npm run artemis -- models
npm run artemis -- --help
```

Installed as a bin (`npm link`, or a published package), the same commands are
`artemis "…"`, `artemis models`.

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

## Models

`artemis models` lists what the plan includes, marks third-party models as such,
and greys out any the server has no credentials for. A third-party model
announces itself on stderr before it answers — a customer should never have to
ask who replied, and Artemis's own reasoning never calls one.

## Layout

| file | holds |
| --- | --- |
| `args.ts` | parsing, pure, fully tested |
| `config.ts` | `~/.artemis/config.json`, permissions, key masking |
| `sse.ts` | incremental server-sent events, byte-wise so split characters survive |
| `client.ts` | the `/v1` calls and their errors |
| `render.ts` | stdout vs stderr, colour, meters, the third-party notice |
| `artemis.ts` | commands and the interactive session |

Typechecked under `tsconfig.cli.json` with `strict` and `noUncheckedIndexedAccess`
(stricter than the rest of the repo, since this is new code):
`npx tsc -p tsconfig.cli.json --noEmit`. Tests: `node --import tsx --test cli/*.test.ts`.
