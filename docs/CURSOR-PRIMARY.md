# Cursor as primary AI (skip Copilot)

Cutline Industries is configured for **Cursor** first. Copilot files in `.github/` are optional backups — you do not need VS Code Copilot for day-to-day work on this repo.

## Quick start

1. Clone repo → open in **Cursor** (desktop recommended).
2. `npm install` && `cp .env.example .env`
3. Copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) → `~/.cursor/mcp.json`
4. `cd tools/phone-approval-lite && npm install` (and `tools/voice-print` if printing)
5. Chat in Cursor — rules in [`.cursor/rules/`](../.cursor/rules/) load automatically.

## Cursor stack (this repo)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER SURFACES                                    │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Cursor Desktop (PC)          │ Cursor mobile / Cloud Agent              │
│ MCP · LAN · full repo        │ PRs · code · no home LAN printer         │
└──────────────┬───────────────┴──────────────────┬───────────────────────┘
               │                                  │
               └──────────────────┬───────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                    CURSOR CLIENT (IDE / cloud UI)                        │
│  Chat · Agent mode · rules · MCP picker · @ mentions                     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│              CURSOR AGENT (orchestrator — Cursor-hosted)                 │
│  Context · prompt · tool loop · permissions                              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
┌──────▼──────┐         ┌─────────▼─────────┐      ┌────────▼────────┐
│ LLM         │         │ Built-in tools     │      │ Repo MCP        │
│ (Composer)  │         │ terminal · edit ·  │      │ phone-approval  │
│             │         │ search · git       │      │ voice-print     │
└─────────────┘         └───────────────────┘      └─────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│  EXECUTION: local PC  │  cloud VM (GitHub-linked PRs)                      │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│  Runtime: PC LAN · Cloud VM · Cursor                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

Flow:

```
Surfaces (Cursor desktop · Cloud · Phone Ops)
    → Client (chat · rules · MCP)
    → Agent loop (context · think → act)
    → Tools (edit · shell · phone-approval · voice-print)
    → Runtime (PC LAN · Cloud VM · Cursor)
```

## Repo map for agents

| Area | Path | Notes |
|------|------|-------|
| Thermal UI | `src/` | `/app/*` Mission Control |
| API | `server/` | `:8787`, Stripe webhook order matters |
| Migrations | `db/migrations/` | `npm run db:migrate` |
| Agent tools | `tools/` | MCP servers |
| Product docs | `docs/` | Platform, Thermal, pipelines |

## MCP tools (local Cursor)

| Server | Config | Purpose |
|--------|--------|---------|
| `phone-approval-lite` | `.cursor/mcp.json.example` | Device approval via ntfy |
| `voice-print` | same | **`print`** in chat → HP OfficeJet |

Requires **Cursor on your PC** for MCP (not mobile cloud chat).

## Copilot optional?

Full comparison: **[COPILOT-VS-CURSOR.md](COPILOT-VS-CURSOR.md)**

| Copilot | Cursor (use this) |
| --- | --- |
| Copilot Chat | **Cursor chat** |
| `copilot-instructions.md` | **`cutline-primary.mdc`** |
| Cloud agent tasks | **Cursor Cloud Agent** |
| VS Code MCP | **`~/.cursor/mcp.json`** |

Config mirrors (if you still use Copilot):

| Cursor | Copilot mirror |
|--------|----------------|
| `.cursor/rules/cutline-primary.mdc` | `.github/copilot-instructions.md` |
| `.cursor/rules/voice-print.mdc` | `.github/agents/voice-print.agent.md` |
| `.cursor/mcp.json.example` | `.vscode/mcp.json`, `.mcp.json` |

You only need one IDE agent stack — **prefer Cursor**.

## Cursor mobile — custom button?

You **cannot** add buttons inside the Cursor mobile chat UI (that toolbar is controlled by Cursor).

**Workaround:** Add **Cutline Ops** to your home screen — bottom **Print** button in the same spot:

1. PC: `cd tools/voice-print && npm start`
2. Phone: open `http://<PC-IP>:8791/mobile.html`
3. Safari → **Add to Home Screen**

See [VOICE-PRINT-PHONE.md](VOICE-PRINT-PHONE.md).

## Related

- [AI-APPLICATION-CARD-BLUEPRINT.md](AI-APPLICATION-CARD-BLUEPRINT.md) — responsible AI card + print HTML
- [PLATFORM.md](PLATFORM.md)
- [THERMAL-MISSION-CONTROL.md](THERMAL-MISSION-CONTROL.md)
- [COPILOT-ARCHITECTURE.md](COPILOT-ARCHITECTURE.md) — Copilot stack reference
- [tools/README.md](../tools/README.md)
