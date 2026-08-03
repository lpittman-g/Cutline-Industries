# Cutline workstreams — keep them separate

Two different efforts landed in the same Cursor chat (“Gaming youtube channel”). **Do not mix them.**

---

## Workstream A — Gaming YouTube / Thermal (this project)

**Owner agent:** Gaming youtube channel (Thermal Mission Control)

| In scope | Paths / notes |
|----------|----------------|
| Thermal heat → clip → distribute → pay → retain | `server/`, `db/migrations/`, `/app/*` |
| VOD autopilot · AI Shorts · YouTube | `scripts/`, `docs/AI-VIDEO-PIPELINE.md` |
| Bounty / Stripe / revenue | Thermal Mission Control docs |
| Public site · Mission Control UI | `src/` |
| SynthLang CI for the product | `.github/workflows/` |
| GitHub Copilot mirror (`@thermal`) | `.github/agents/thermal.agent.md`, `.github/instructions/thermal.instructions.md` |

**Resume here** for product work (e.g. S3 media persistence, auth + roles).

---

## Workstream B — Cursor AI layer + tools (unrelated to the gaming channel)

**Owner agent:** Separate Cursor agent — see [AGENT-HANDOFF-CURSOR-AI-LAYER.md](AGENT-HANDOFF-CURSOR-AI-LAYER.md)

**Conversation boundary:** In the Gaming youtube channel chat, everything **from this line down was Workstream B** (not the YouTube project):

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
| Clips, bounty, Twitch heat, Shorts, Stripe for clips | **Workstream A** |
| Print, Copilot, Cursor MCP, Application Card, Excel MCP autopilot | **Workstream B** |

When in doubt, ask which workstream — do not fold B into A’s PRs or vice versa.
