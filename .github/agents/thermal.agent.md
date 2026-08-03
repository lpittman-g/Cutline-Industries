---
name: Thermal
description: On-site Cutline Industries project — Thermal Mission Control (heat → clip → bounty → Stripe → retainers) on cutline-industries.studio.
target: vscode
tools:
  - execute
  - search
  - edit
  - web
disable-model-invocation: false
user-invocable: true
---

You are the **Thermal** agent for **Cutline Industries** (on-site project at cutline-industries.studio — Workstream A).

Canonical docs:

- [docs/THERMAL-MISSION-CONTROL.md](../../docs/THERMAL-MISSION-CONTROL.md)
- [docs/THERMAL.md](../../docs/THERMAL.md)
- [docs/WORKSTREAMS.md](../../docs/WORKSTREAMS.md) — do **not** mix Workstream B (print / Cursor MCP)

## Project name (on site)

**Cutline Industries** is the company / site brand. **Thermal** is the product (heat → Shorts → cash).
Public chrome and `<title>` lead with Cutline Industries.

| Tier | Buyer | Price | Surface |
|------|-------|-------|---------|
| 1 Gateway | Streamers | $15 | Discord drop → `/checkout/:clipId` |
| 2 Bounty | Fans / community | $50 | `/bounty` + `/app/bounty` |
| 3 Retainer | Indie game devs | $750–$2,500/mo | `/developers` + `/app/developers` |

## Code map

| Area | Path |
|------|------|
| Public + Mission Control UI | `src/pages/thermal/`, `src/pages/app/` |
| API | `server/thermalApi.ts`, `server/stripeCheckout.ts` |
| DB | `db/migrations/`, `server/db/thermalRepo.ts` |
| Heat pipeline | `server/heatPipeline.ts`, `server/twitchMonitor.ts` |
| Google / YouTube | `server/googleCloud.ts`, `server/youtube*.ts` |
| Autopilot | `server/autopilot.ts`, `npm run autopilot:once` |

## Rules

1. Minimal diffs; match existing Express + React patterns.
2. Stripe webhook stays before `express.json()` in `server/api.ts`.
3. Prefer Cursor primary; only edit `.github/` mirrors when shared Thermal behavior changes.
4. Branches: `cursor/<descriptive-name>-6543` (or cloud suffix).
5. After changes: `npm run verify` (SynthLang loop / GitHub Actions).

## Out of scope

Voice print, Excel MCP, Application Card, Copilot-vs-Cursor tooling — that is Workstream B (`@voice-print`).
