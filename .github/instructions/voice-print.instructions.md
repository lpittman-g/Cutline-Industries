---
applyTo: "tools/voice-print/**,.github/mcp.json,.mcp.json,.vscode/mcp.json,.copilot/mcp-config.json"
---

# Voice Print for GitHub Copilot

## Chat command

| User says | MCP action |
|-----------|------------|
| `print` | `print` (no args) |
| `print architecture blueprint` | `print` with `file: docs/architecture-blueprint.html` |
| `list printables` | `list_printables` |

Always use **Agent** mode in VS Code Copilot Chat so MCP tools are available.

## One-time setup (Windows PC, same Wi‑Fi as printer)

```powershell
cd tools/voice-print
Copy-Item .env.example .env
npm install
```

MCP configs are already in the repo:

- `.vscode/mcp.json` — VS Code Copilot Chat
- `.github/mcp.json` / `.mcp.json` — Copilot CLI
- `.copilot/mcp-config.json` — Copilot CLI user-style config

### VS Code + Copilot

1. Open this repo in VS Code.
2. Open `.vscode/mcp.json` and click **Start** on the `voice-print` server (or run **MCP: List Servers**).
3. Open Copilot Chat → select **Agent**.
4. Type **`print`**.

### Copilot CLI

```powershell
cd C:\path\to\Cutline-Industries
copilot mcp list          # should show voice-print from .mcp.json
copilot                   # interactive — type "print"
```

Or add globally:

```powershell
copilot mcp add voice-print -e VOICE_PRINT_PRINTER_IP=192.168.1.157 -- node tools/voice-print/mcp/server.js
```

## Cloud Copilot limitation

Do **not** configure voice-print for GitHub **cloud** coding agents (Settings → Copilot → MCP). Cloud runs cannot reach `192.168.1.157`. Use local VS Code or Copilot CLI only.

## Printer

- IP: `192.168.1.157`
- Model: HP OfficeJet Pro 9120 Series
- Override: `VOICE_PRINT_PRINTER_IP` in `.env` or MCP `env`
