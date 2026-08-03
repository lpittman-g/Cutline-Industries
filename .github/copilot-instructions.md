# Cutline Industries — GitHub Copilot instructions (optional)

> **Primary agent:** [Cursor](../docs/CURSOR-PRIMARY.md) — see [COPILOT-VS-CURSOR.md](../docs/COPILOT-VS-CURSOR.md). Use Copilot only if you prefer VS Code.

Keep workstreams separate — [docs/WORKSTREAMS.md](../docs/WORKSTREAMS.md):

| Stream | Agent | Scope |
|--------|--------|--------|
| **A** | `@thermal` | On-site **Cutline Industries** / Thermal Mission Control |
| **B** | `@voice-print` | Print / Cursor MCP / Application Card |

## Voice Print (Workstream B)

Follow [tools/voice-print/CHAT-PRINT.md](../tools/voice-print/CHAT-PRINT.md).

**Copilot:** use custom agent **`@voice-print`** (`.github/agents/voice-print.agent.md`).

When the user says **`print`**:

1. MCP tool **`print`** (default: `docs/combined-print.html`)
2. Fallback: `cd tools/voice-print && npm run print -- docs/combined-print.html`

**Apps matrix:** [tools/voice-print/APPS.md](../tools/voice-print/APPS.md) — cloud/mobile cannot reach the HP; phone uses LAN web UI.

## Thermal (Workstream A) — on-site Cutline Industries

**Site brand:** Cutline Industries (`cutline-industries.studio`). **Product:** Thermal.

**Copilot:** use custom agent **`@thermal`** (`.github/agents/thermal.agent.md`).

Canonical docs: [docs/THERMAL-MISSION-CONTROL.md](../docs/THERMAL-MISSION-CONTROL.md), [docs/THERMAL.md](../docs/THERMAL.md).

| Tier | Product | Price |
|------|---------|-------|
| 1 | Live in-stream clip unlock | $15 |
| 2 | Bounty board 3-clip pack | $50 |
| 3 | Indie Dev Wishlist Engine (retainers CRM) | $750–$2,500/mo |

Key routes: `/`, `/bounty`, `/developers`, `/checkout/:clipId`, `/app/*`.

```bash
npm install && cp .env.example .env
npm run db:migrate
npm run start          # UI :5173 + API :8787
npm run verify         # lint + typecheck + test (SynthLang loop)
```

Stripe webhook must stay registered **before** `express.json()` in `server/api.ts`.

## Repo tools

| Tool | Purpose |
|------|---------|
| `tools/voice-print` | IPP print to HP OfficeJet via MCP `print` |
| `tools/phone-approval-lite` | ntfy + web device approval |
| Thermal Mission Control | `npm run start` — API `:8787`, UI `:5173` |
| SynthLang CI | `.github/workflows/synthlang-pipeline.yml` |
| Google Workspace / YouTube | `server/googleCloud.ts`, `GOOGLE_CLOUD_PROJECT` |
| AWS deploy skeleton | `infra/aws/pipeline.skeleton.json` (Amplify artifact on `main`) |
