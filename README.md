# Cutline Industries Platform

**Thermal** — turn live stream heat into monetized Shorts.

Public site: [cutline-industries.studio](https://cutline-industries.studio)  
Company email: lpittman@cutline-industries.studio

This repository is the **full Cutline platform monorepo**: the Thermal web app, AI video pipeline, YouTube Autopilot, agent tools, and business docs.

## Repository layout

```
├── src/                  # Thermal public site + Mission Control UI (/app)
├── server/               # Express API, Autopilot, AI video pipeline
├── scripts/              # Trend radar, AI scripts, AWS helpers, SynthLang verify
├── synthlang/            # Autonomous CI/autopilot config
├── tools/
│   ├── phone-approval-lite/    # Default: ntfy + /approve (no Apple Developer)
│   ├── phone-approval-apple/   # Archived — not used
│   └── email-to-cursor/        # Email → Cursor Cloud Agent bridge
├── docs/                 # Product, pipeline, and business documentation
├── infra/                # AWS skeleton configs
└── db/                   # Thermal Postgres migrations
```

See [`docs/PLATFORM.md`](docs/PLATFORM.md) for the full architecture.

**Workstreams** (keep separate): [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md) — A = Gaming/Thermal · B = Cursor AI layer / print / Excel MCP.

## Quick start (Thermal web + API)

```bash
npm install
cp .env.example .env
npm run start          # UI + API
```

| URL | Purpose |
|-----|---------|
| http://127.0.0.1:5173 | Thermal site + `/os` command center |
| http://127.0.0.1:8787 | Cutline API |

## Content pipelines

### VOD Autopilot (gameplay → Shorts)

Drop `.mp4` files in `inbox/`:

```bash
npm run autopilot          # continuous
npm run autopilot:once     # one pass
```

### AI video pipeline (Thermal project Shorts)

Creates faceless Shorts about Thermal/Cutline — no VOD required:

```bash
pip install edge-tts
npm run ai:pipeline:once
npm run ai:pipeline
```

Public audience input: `/feedback` on the site.

Docs: [`docs/AI-VIDEO-PIPELINE.md`](docs/AI-VIDEO-PIPELINE.md)

## Google OAuth — YouTube + Gmail (one-time)

Full guide: [`docs/GOOGLE-OAUTH.md`](docs/GOOGLE-OAUTH.md)

1. OAuth client → `client_secret.json`
2. Enable **YouTube Data API v3** and **Gmail API** on project `utility-mapper-504300-d6`
3. Set `GOOGLE_CLOUD_PROJECT` + `GOOGLE_WORKSPACE_SENDER_EMAIL` in `.env`
4. Authorize YouTube + `gmail.send` scopes (Playground or Autopilot **Open OAuth**) → save `token.json`
5. AI Shorts default to **public** (`CUTLINE_AI_PRIVACY=public`)

| Secret / config | Purpose |
|-----------------|---------|
| `client_secret.json` | OAuth client ID + secret |
| `token.json` | Refresh/access tokens after authorization |
| `GOOGLE_CLOUD_PROJECT` | GCP project id |
| `GOOGLE_WORKSPACE_SENDER_EMAIL` | Gmail from-address |

## Agent tools (Cursor primary)

**Setup:** [`.cursor/README.md`](.cursor/README.md) · [`docs/CURSOR-PRIMARY.md`](docs/CURSOR-PRIMARY.md) · [`docs/COPILOT-VS-CURSOR.md`](docs/COPILOT-VS-CURSOR.md)

Open this repo in **Cursor** — Copilot/VS Code optional.

| Tool | Path | Purpose |
|------|------|---------|
| Phone approval | `tools/phone-approval-lite/` | ntfy push + `/approve` — MCP in Cursor |
| Voice print | `tools/voice-print/` | Chat **`print`** → HP OfficeJet (local PC) |
| Email → Cursor | `tools/email-to-cursor/` | Email triggers Cloud Agent runs |
| SynthLang CI | `.github/workflows/synthlang-pipeline.yml` | Lint, typecheck, test, build |

### Ramp CLI output modes

Ramp CLI supports both table and JSON output modes:

| Flag | Behavior |
|------|----------|
| `--human` | Human-readable table output |
| `--agent` | Machine-readable JSON output |
| `--wide` | Show all columns in table output |

Repo scripts for common auth/data calls with explicit mode selection:

```bash
npm run ramp:auth:login
npm run ramp:auth:status
npm run ramp:auth:logout
npm run ramp:users:me
npm run ramp:users:me:human
npm run ramp:users:me:wide
npm run ramp:bills:search:acme
npm run ramp:transactions:list
RAMP_FROM_DATE=2025-01-01 npm run ramp:transactions:list:from
```

## Deploy

- **CI:** GitHub Actions on push to `main`
- **Staging:** AWS Amplify (`staging.*.amplifyapp.com`)
- **Production domain:** `cutline-industries.studio` (Route 53 + Amplify — DNS cutover pending)

## Business docs

PDFs in [`docs/business/`](docs/business/):

- Cutline Industries Blueprint
- 4-Week Outreach Plan
- Stripe Authorization Letter

AI Application Card (Cursor primary): [`docs/AI-APPLICATION-CARD-BLUEPRINT.md`](docs/AI-APPLICATION-CARD-BLUEPRINT.md) · printable [`docs/ai-application-card-blueprint.html`](docs/ai-application-card-blueprint.html)

## Secrets (never commit)

| File | Purpose |
|------|---------|
| `.env` | Runtime config |
| `client_secret.json` | Google OAuth client ID + secret |
| `token.json` | YouTube + Gmail refresh/access tokens |
| `tools/*/secrets/` | ntfy pair secret, device tokens |

## Brand

**Cutline Industries** builds **Thermal** — stream heat → Shorts → cash.
