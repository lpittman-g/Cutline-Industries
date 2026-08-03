---
applyTo: "server/thermalApi.ts,server/stripeCheckout.ts,server/db/**,db/migrations/**,src/pages/app/**,src/pages/thermal/**,src/lib/thermalApi.ts,docs/THERMAL*.md,.env.example"
---

# Thermal for GitHub Copilot + Cursor

Unified with Cursor — Workstream A only. See [docs/WORKSTREAMS.md](../../docs/WORKSTREAMS.md).

**Copilot agent:** `@thermal` → [.github/agents/thermal.agent.md](../agents/thermal.agent.md)

**Source of truth:** [docs/THERMAL-MISSION-CONTROL.md](../../docs/THERMAL-MISSION-CONTROL.md)

## Implemented loop

1. Heat → clip (Twitch / force spike)
2. Stripe Checkout + sales ledger (gateway $15)
3. Bounty distribution ($50)
4. Indie Dev CRM + retainers ($750–$2,500/mo subscription)

## Tier 3 retainers (keep in sync)

| Piece | Location |
|-------|----------|
| Schema | `db/migrations/001_thermal_core.sql`, `005_thermal_retainers_crm.sql` |
| Repo | `server/db/thermalRepo.ts` — `listRetainers`, `insertRetainer`, `activateRetainer` |
| API | `/api/developers`, `/pipeline`, `POST /checkout`, `/:id/checkout` |
| Stripe | `createRetainerCheckoutSession` — `mode: subscription` |
| Mission Control | `/app/developers` → `DevCrmPage.tsx` |
| Public | `/developers` → `DevelopersPage.tsx` |

Statuses: `prospect` → `sample_sent` → `active` | `cancelled`.

## Commands

```bash
npm run db:migrate
npm run start
npm run verify
npm run autopilot:once
```

## Env

See `.env.example`: `DATABASE_URL`, `STRIPE_*`, `STRIPE_PRICE_RETAINER`, `GOOGLE_CLOUD_PROJECT`, `CUTLINE_PUBLIC_URL=https://cutline-industries.studio`.
