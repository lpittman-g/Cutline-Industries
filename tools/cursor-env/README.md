# cursor-env

Terminal view of Cutline’s Cursor Cloud environment — no rebuild required.

```bash
npm run env:view
npm run env:view -- --json
npm run env:view -- open      # dashboard URL
npm run env:view -- agents    # needs CURSOR_API_KEY
```

## What it shows

| Section | Source |
|---------|--------|
| Name, snapshot, install, start, terminals, ports | `.cursor/environment.json` |
| `.env` / `node_modules` / Postgres / API / Vite | Live local probes |
| Builds history | **Not** on Cursor’s public API — use [dashboard Environments → Builds](https://cursor.com/dashboard/cloud-agents#environments) or ask a Cloud Agent |

## Optional cloud agents list

Create an API key at [cursor.com/dashboard/api](https://cursor.com/dashboard/api), then:

```bash
export CURSOR_API_KEY=...
npm run env:view -- agents
```

That lists recent Cloud Agents via `GET /v1/agents`. It cannot list environment Builds (no public endpoint yet).
