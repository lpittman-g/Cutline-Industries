# ARTEMIS.md — Cutline Industries

Agent orientation for the Cutline Industries monorepo.
Read this first. Every rule here is permanent unless the user explicitly revokes it.

---

## Security rules (non-negotiable — enforce on every task)

| Rule | Detail |
|------|--------|
| No outside AI models | Never call OpenAI, Claude, Grok, Gemini, Cohere, Ollama, or any external LLM in product code or Artemis decisions. Blueprint Decisions 5 and 12. |
| Secrets in Key Vault only | Secrets live in Azure Key Vault `artemis-kv-6b22c1`. Never write them to code, chat, tickets, or logs. |
| No token/key paste in chat | Never ask the user to paste tokens, keys, or passwords into conversation. |
| H100 confirmation required | The H100 VM costs ~$98/hr. Always confirm with the user before starting it. |
| $2 M/month cap | No infrastructure spend exceeds this without review. |

---

## What this project is

**Thermal** — turn live-stream heat into monetised YouTube Shorts.
Pipeline: Twitch heat spikes → auto-clip → title → upload → Stripe/YPP monetisation.

**Cutline Platform** — self-hosted CI/CD replacing GitHub Actions + Vercel.
Runs inside the Artemis network. Projects register here; builds run on VPS.

**Artemis** — proprietary AI orchestrator built by Cutline Industries.
11 specialist brains (see below). All inference runs on own weights — never external AI.

---

## Architecture

```
Browser
  └─ Caddy (auto-HTTPS)  infra/Caddyfile
       ├─ / → nginx → dist/          (Vite React SPA)
       └─ /api/* → Express API :8787  server/api.ts
            ├─ /api/artemis/*   server/artemis/routes.ts
            ├─ /api/deploy/*    server/deploy/routes.ts   ← Cutline Platform
            ├─ /api/thermal/*   server/thermalApi.ts
            └─ /api/auth/*      server/auth/authRoutes.ts

Artemis inference (own model)
  └─ artemis-serve  :8100  scripts/serve/artemis-serve.py
       ARTEMIS_CORE_URL=http://artemis-serve:8100  (set in docker-compose)

Azure Container Apps (backup inference)
  └─ artemis-api.whitemeadow-751c0637.eastus.azurecontainerapps.io
       ARTEMIS_CORE_URL=<above azure url>  (in .env.production)

Postgres :5432  (local dev: postgres/postgres/thermal)
```

---

## Docker Compose stack  (docker-compose.yml)

| Service | Image / Build | Port | Role |
|---------|--------------|------|------|
| `artemis-serve` | `scripts/serve/Dockerfile.artemis-serve` | 8100 | GPT-2 inference — starts on `docker compose up` |
| `api` | `infra/Dockerfile.api` | 8787 | Express API + Vite frontend |
| `web` | `nginx:alpine` | 80 | Serves `dist/` |
| `caddy` | `caddy:2-alpine` | 80/443 | Reverse proxy, auto-HTTPS |

`api` gets `ARTEMIS_CORE_URL=http://artemis-serve:8100` automatically from compose.
`artemis-serve` defaults to `ARTEMIS_MODEL_PATH=gpt2` — downloads ~500 MB on first start.
Fine-tuned checkpoint: mount into `artemis_checkpoint` volume (see scripts/train/).

---

## Artemis brains

| Brain | Title | Domain |
|-------|-------|--------|
| Artemis | Orchestrator | Routes + synthesises all brains |
| Apollo | Navigator | Roadmaps, strategy, business |
| Saturn | Code | Writes, fixes, explains code |
| Neptune | Deep Research | Evidence, cited summaries |
| Pluto | Systems Architecture | Infrastructure, Docker, cloud |
| Mars | Shipping | Go/no-go, release checklists |
| Mercury | Memory | Continuity, recall |
| Venus | Auditor | Checks every brain's output |
| Jupiter | Multimodal | Images, screenshots, charts |
| Earth | Voice | Tone, conversation, writing |
| Uranus | Math & Logic | Calculation, proofs, stats |

Routing logic: `server/artemis/store.ts → streamRunArtemis()`
Priority: `VLLM_BASE_URL` → `ARTEMIS_CORE_URL` → stub

---

## Key files

| Path | Purpose |
|------|---------|
| `server/api.ts` | Express entry point |
| `server/createApp.ts` | App factory — mounts all route groups |
| `server/artemis/routes.ts` | Artemis chat, memory, RAG, voice, drive |
| `server/artemis/store.ts` | `streamRunArtemis()` — inference routing |
| `server/deploy/routes.ts` | Cutline Platform REST API |
| `server/deploy/runner.ts` | Build executor (npm ci → typecheck → build → docker compose up → migrate) |
| `server/deploy/store.ts` | File-backed project/deployment persistence |
| `scripts/serve/artemis-serve.py` | HuggingFace inference server (CPU/GPU) |
| `scripts/serve/Dockerfile.artemis-serve` | Container for inference |
| `scripts/train/corpus.py` | Build Artemis fine-tuning corpus → `data/artemis-corpus.jsonl` |
| `scripts/train/train.py` | Fine-tune GPT-2 on corpus → `./artemis-checkpoint` |
| `scripts/train/deploy-weights.sh` | Deploy weights to Azure Container App |
| `scripts/deploy/setup-vps.sh` | First-time VPS provisioning (Ubuntu 22.04) |
| `.github/workflows/deploy.yml` | CI: typecheck → build → SSH → docker compose up |
| `infra/Dockerfile.api` | Multi-stage Node 20 alpine for API |
| `infra/Caddyfile` | Auto-HTTPS reverse proxy config |
| `docker-compose.yml` | Full 4-service stack |

---

## Standard commands

```bash
npm run dev          # Vite SPA + API (concurrent, ports 5173 + 8787)
npm run api          # API only
npm run typecheck    # tsc -b --noEmit  (must pass clean before any commit)
npm run build        # Production Vite build → dist/
npm run lint         # oxlint
npm test             # node test runner
npm run verify       # lint + typecheck + test
npm run db:migrate   # Apply Postgres migrations (idempotent)
```

---

## Environment variables (see .env.example for full list)

Critical ones agents need to know:

| Var | What it does |
|-----|-------------|
| `ARTEMIS_CORE_URL` | Points API at the inference server. Set automatically in docker-compose. For Azure: `https://artemis-api.whitemeadow-751c0637.eastus.azurecontainerapps.io` |
| `VLLM_BASE_URL` | Overrides ARTEMIS_CORE_URL — use for a vLLM GPU host (OpenAI-compat SSE) |
| `ARTEMIS_MODEL_PATH` | Model path or HF ID for artemis-serve (default: `gpt2`) |
| `DATABASE_URL` | Postgres connection string |
| `CUTLINE_DRY_RUN` | `1` = all integrations no-op (safe for dev) |
| `AUTH_BOOTSTRAP_ADMIN_EMAIL` | First matching signup becomes admin |

---

## Cutline Platform API  (mounts at /api/deploy)

```
GET    /api/deploy/projects                      list projects
POST   /api/deploy/projects                      create project
PATCH  /api/deploy/projects/:id                  update project
DELETE /api/deploy/projects/:id                  delete project
GET    /api/deploy/projects/:id/env              list env vars (masked)
PUT    /api/deploy/projects/:id/env              replace env vars
POST   /api/deploy/projects/:id/env              upsert env var
DELETE /api/deploy/projects/:id/env/:key         remove env var
POST   /api/deploy/projects/:id/deploy           trigger build (fire-and-forget)
GET    /api/deploy/projects/:id/deployments      list deployments
GET    /api/deploy/projects/:id/deployments/:depId  get deployment
GET    /api/deploy/projects/:id/deployments/:depId/logs  SSE log stream
DELETE /api/deploy/projects/:id/deployments/:depId  cancel
POST   /api/deploy/webhook/:projectId            git webhook (replaces GitHub webhook)
GET    /api/deploy/status                        platform status summary
```

Build sequence: `npm ci` → typecheck → `npm run build` → `docker compose up -d --build` → `db:migrate`

---

## Pending actions (what the next agent should do)

### 1. Fix GitHub Actions billing — BLOCKED
All CI runs fail: `"The job was not started because your account is locked due to a billing issue."`
Fix: github.com/settings/billing → resolve payment. Then push any commit to trigger a deploy.

### 2. Run `docker compose up` on VPS — first Artemis inference
SSH into the VPS and run:
```bash
cd /srv/cutline-industries && git pull origin main && docker compose up -d --build --remove-orphans
docker compose logs -f artemis-serve   # watch GPT-2 download (~500 MB, ~2 min)
```
Once `[artemis-serve] Ready on port 8100` appears, Artemis chat serves real responses.

### 3. Fine-tune Artemis weights (optional, improves quality)
```bash
python scripts/train/corpus.py    # build corpus
python scripts/train/train.py     # fine-tune GPT-2 → ./artemis-checkpoint
# then copy checkpoint into the artemis_checkpoint docker volume and restart
```

### 4. cutline-industries.studio DNS cutover
DNS is currently on Squarespace. Point it at Vercel (or the VPS):
- **Vercel**: A `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`
- **VPS (self-hosted)**: A `@` → `<vps-ip>`, A `www` → `<vps-ip>`

### 5. Vercel AI Gateway
Set up. Rewrites `/root/.claude/settings.json` — Claude Code routes through Vercel AI Gateway.
Token created during setup: rotate if it appeared in chat.

---

## VPS deploy (manual)

```bash
# First time — run on fresh Ubuntu 22.04:
curl -fsSL https://raw.githubusercontent.com/lpittman-g/Cutline-Industries/main/scripts/deploy/setup-vps.sh | bash

# Subsequent deploys:
cd /srv/cutline-industries
git pull origin main
docker compose up -d --build --remove-orphans
docker compose exec api node --import tsx/esm db/migrate.ts
```

---

## Postgres (dev)

```bash
bash scripts/cloud-postgres.sh start   # start PG 16
npm run db:migrate                     # apply migrations
```
Local: `postgres://postgres:postgres@127.0.0.1:5432/thermal`
Migrations are idempotent — safe to re-run.

---

## What NOT to do

- Do not call OpenAI, Anthropic, Gemini, or any external AI API from product code
- Do not write secrets to `.env.example`, code comments, or commit messages
- Do not start the H100 VM without confirming with the user
- Do not use `git add -A` — stage specific files to avoid committing secrets
- Do not push a broken typecheck (`npm run typecheck` must exit 0)
