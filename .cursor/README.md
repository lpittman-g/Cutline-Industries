# Cursor — primary AI for this repo

**You do not need GitHub Copilot** for Cutline work. Open this repo in **Cursor** (desktop for MCP + LAN tools; cloud for PRs and code).

## One-time setup

```bash
npm install
cp .env.example .env
```

### MCP (local Cursor on your PC)

Copy [`.cursor/mcp.json.example`](mcp.json.example) → `~/.cursor/mcp.json`, then:

```bash
cd tools/phone-approval-lite && npm install
cd ../voice-print && npm install
```

Restart Cursor. MCP gives you:

- **phone-approval-lite** — push approve/deny to iPhone (ntfy)
- **voice-print** — type **`print`** in chat → HP OfficeJet
- **openaiDeveloperDocs** — live OpenAI platform documentation

For cloud Automations, use the restricted
[`mcp.automation.example.json`](mcp.automation.example.json) connection pack and
follow [`docs/THERMAL-AUTOMATION-MCP.md`](../docs/THERMAL-AUTOMATION-MCP.md).
Do not attach the LAN printer or phone tools to a cloud Automation.

### OpenAI Developers plugin (desktop)

Settings → Plugins → paste `https://github.com/openai/openai-developers-for-cursor` → Install.
Details: [docs/OPENAI-DEVELOPERS-PLUGIN.md](../docs/OPENAI-DEVELOPERS-PLUGIN.md). Portable skills live in [`skills/`](skills/).

### Rules (already in repo)

| Rule | Purpose |
|------|---------|
| [`rules/cutline-primary.mdc`](rules/cutline-primary.mdc) | General repo agent — always on |
| [`rules/voice-print.mdc`](rules/voice-print.mdc) | Chat command **`print`** |

## What to use instead of Copilot

See **[docs/COPILOT-VS-CURSOR.md](../docs/COPILOT-VS-CURSOR.md)** for the full table.

| Copilot | Cursor (use this) |
| --- | --- |
| Copilot Chat | **Cursor chat** |
| `copilot-instructions.md` | **`cutline-primary.mdc`** |
| Cloud agent tasks | **Cursor Cloud Agent** |
| VS Code MCP | **`~/.cursor/mcp.json`** |

## Docs

- [docs/COPILOT-VS-CURSOR.md](../docs/COPILOT-VS-CURSOR.md) — Copilot ↔ Cursor map
- [docs/CURSOR-PRIMARY.md](../docs/CURSOR-PRIMARY.md) — full guide
- [docs/COPILOT-ARCHITECTURE.md](../docs/COPILOT-ARCHITECTURE.md) — stack diagram
