# Chat command: **print**

Single behavior for **Cursor**, **GitHub Copilot** (VS Code + CLI), and the phone web UI.

## When the user says `print`

| Input | Action |
|-------|--------|
| `print` | Send default file: `docs/combined-print.html` |
| `print architecture blueprint` | `docs/architecture-blueprint.html` |
| `list printables` | List catalog via MCP `list_printables` |

## Agent steps (Cursor + Copilot on PC)

1. Call MCP tool **`print`** (no `file` arg for default).
2. If MCP unavailable, run:
   ```bash
   cd tools/voice-print && npm run print -- docs/combined-print.html
   ```
3. Confirm file sent and printer IP (`192.168.1.157`).

## MCP server (shared config)

```json
"voice-print": {
  "type": "stdio",
  "command": "node",
  "args": ["tools/voice-print/mcp/server.js"],
  "env": {
    "VOICE_PRINT_PRINTER_IP": "192.168.1.157",
    "VOICE_PRINT_DEFAULT_FILE": "docs/combined-print.html"
  },
  "tools": ["print", "list_printables"]
}
```

Used in: `.vscode/mcp.json`, `.mcp.json`, `.github/mcp.json`, `.copilot/mcp-config.json`, `.cursor/mcp.json.example`.

## Copilot custom agent

In VS Code Copilot Chat, select **`@voice-print`** (see `.github/agents/voice-print.agent.md`).

## Not supported in cloud chat

GitHub **cloud** Copilot tasks and **Cursor mobile** cannot reach the HP on LAN. Use the phone browser flow in [`APPS.md`](APPS.md).
