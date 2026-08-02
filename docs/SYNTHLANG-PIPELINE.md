# SynthLang autopilot pipeline

Cutline Industries uses a [SynthLang](https://synthlang.dev) autopilot config for fully autonomous code synthesis with a fixed verification loop before merge.

## Config

- **File:** `synthlang/autopilot.json`
- **Mode:** `fully_autonomous`
- **Default language:** TypeScript (Vite + React app in repo root)

## Verification loop

| Step | Command |
|------|---------|
| Lint | `npm run lint -- --fix` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |

Run locally (matches agent loop):

```bash
./scripts/synthlang/verify.sh
```

CI runs the same checks (lint without auto-fix) on every push/PR to `main` via `.github/workflows/synthlang-pipeline.yml`.

## Authentication

The autopilot expects:

- `GITHUB_TOKEN` — bearer token for GitHub API
- `GITHUB_EMAIL` — commit author email (maps to `{{GITHUB_EMAIL}}` in config)

These are already available in Cursor Cloud Agent runs. Add them as GitHub Actions secrets if you extend the deploy job to push artifacts automatically.

## Deployment

`deployment_autopilot.github_actions` targets branch `main`. The workflow uploads a built `dist/` artifact on successful main builds; wire Amplify or S3 deploy steps when AWS credentials are added to the repo secrets.
