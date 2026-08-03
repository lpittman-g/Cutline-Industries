# Copilot vs Cursor (use Cursor)

Cutline Industries is set up for **Cursor** first. GitHub Copilot configs in `.github/` are optional mirrors.

## Quick map

| Copilot | Cursor (use this) |
| --- | --- |
| Copilot Chat | **Cursor chat** (Agent mode) |
| `copilot-instructions.md` | **`cutline-primary.mdc`** |
| Cloud agent tasks | **Cursor Cloud Agent** |
| VS Code MCP (`.vscode/mcp.json`) | **`~/.cursor/mcp.json`** |
| `@voice-print` custom agent | **`voice-print` rule + MCP** — chat **`print`** |
| `@thermal` custom agent | **Cursor Cloud / Agent** on Thermal (Workstream A) |
| Copilot CLI (`.mcp.json`) | **Cursor desktop + MCP** (same servers) |
| GitHub.com Copilot task URL | **cursor.com/agents** Cloud Agent run |
| Phone Copilot / VS Code | **Cursor mobile chat** + [**Cutline Ops bar**](../tools/voice-print/public/mobile.html) for Print button |

## File paths in this repo

| Purpose | Copilot (optional) | Cursor (primary) |
| --- | --- | --- |
| Repo-wide instructions | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | [`.cursor/rules/cutline-primary.mdc`](../.cursor/rules/cutline-primary.mdc) |
| Print command | [`.github/agents/voice-print.agent.md`](../.github/agents/voice-print.agent.md) | [`.cursor/rules/voice-print.mdc`](../.cursor/rules/voice-print.mdc) |
| Thermal / Gaming YouTube | [`.github/agents/thermal.agent.md`](../.github/agents/thermal.agent.md) | [docs/THERMAL-MISSION-CONTROL.md](THERMAL-MISSION-CONTROL.md) + Cursor Agent |
| MCP config | `.vscode/mcp.json`, `.mcp.json`, `.github/mcp.json` | [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) → `~/.cursor/mcp.json` |
| Shared print rules | — | [`tools/voice-print/CHAT-PRINT.md`](../tools/voice-print/CHAT-PRINT.md) |
| Setup script | — | [`scripts/setup-cursor.ps1`](../scripts/setup-cursor.ps1) / [`setup-cursor.sh`](../scripts/setup-cursor.sh) |

## When to use which

| Task | Use |
| --- | --- |
| Edit code, PRs, Thermal, docs | **Cursor** (desktop or cloud agent) |
| Device approval (ntfy) | **Cursor on PC** + `phone-approval-lite` MCP |
| Print blueprints to HP | **Cursor on PC** chat **`print`**, or phone [**mobile Ops bar**](VOICE-PRINT-PHONE.md) |
| You only have VS Code + Copilot | Copilot mirrors work — same MCP in `.vscode/mcp.json` |

## Setup (Cursor only)

```bash
npm install
cp .env.example .env
./scripts/setup-cursor.sh   # or .\scripts\setup-cursor.ps1 on Windows
```

Open repo in **Cursor desktop**. See [CURSOR-PRIMARY.md](CURSOR-PRIMARY.md).

## Related

- **[AI-APPLICATION-CARD-BLUEPRINT.md](AI-APPLICATION-CARD-BLUEPRINT.md)** — printable Application Card blueprint
- [ai-application-card-blueprint.html](ai-application-card-blueprint.html) — print via voice-print
- [CURSOR-PRIMARY.md](CURSOR-PRIMARY.md) — full Cursor guide
- [COPILOT-ARCHITECTURE.md](COPILOT-ARCHITECTURE.md) — Copilot stack diagram
- [VOICE-PRINT-PHONE.md](VOICE-PRINT-PHONE.md) — phone Print button (Cursor mobile UI can't be customized)
