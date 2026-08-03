# Cutline workstreams — keep them separate

Two efforts mixed in one Cursor chat. **Do not mix them.** This repo is **Cutline Industries** — not a gaming YouTube channel project.

---

## Workstream A — Cutline Industries product platform

**Owner agent:** Cutline Industries (this repo’s product work)

| In scope | Paths / notes |
|----------|----------------|
| Public site · Mission Control · Creator OS | `src/` |
| API, heat/clip pipeline, revenue tools | `server/`, `db/migrations/` |
| Autopilot / AI media pipeline (optional tooling) | `scripts/`, `docs/AI-VIDEO-PIPELINE.md` |
| SynthLang CI | `.github/workflows/` |

**Resume here** for product, domain, and platform work.

---

## Workstream B — Cursor AI layer + tools

**Owner agent:** Separate Cursor agent — see [AGENT-HANDOFF-CURSOR-AI-LAYER.md](AGENT-HANDOFF-CURSOR-AI-LAYER.md)

**Conversation boundary:** Everything from the **mcp-server-excel Agent Task** line downward in the earlier mixed chat was Workstream B:

- GitHub Copilot / Agent Tasks on **mcp-server-excel**  
  `https://github.com/lpittman-g/mcp-server-excel/tasks/6a19f017-ea16-4a62-a5c4-4d0cb077641f`
- Voice print → HP OfficeJet (`tools/voice-print`)
- Cursor-primary vs Copilot (`docs/CURSOR-PRIMARY.md`, `docs/COPILOT-VS-CURSOR.md`)
- AI Application Card blueprint
- Phone Ops bar (`/mobile.html`)
- Architecture: Surfaces → … → Runtime (PC LAN · Cloud VM · Cursor)

| In scope | Paths |
|----------|--------|
| Cursor rules / MCP | `.cursor/`, `scripts/setup-cursor.*` |
| Voice print | `tools/voice-print/` |
| Phone approval MCP | `tools/phone-approval-lite/` |
| Excel sister repo | https://github.com/lpittman-g/mcp-server-excel |
| Application Card | `docs/AI-APPLICATION-CARD-BLUEPRINT.md` |

**Printer:** HP OfficeJet Pro 9120 · `192.168.1.157` (local LAN only — not cloud chat)

---

## Rule for agents

| If the user is talking about… | Work in… |
|-------------------------------|----------|
| Site, domain, Mission Control, OS terminal, API, revenue | **Workstream A** |
| Print, Copilot, Cursor MCP, Application Card, Excel MCP autopilot | **Workstream B** |

When in doubt, ask which workstream — do not fold B into A’s PRs or vice versa.
