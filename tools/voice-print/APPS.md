# Voice Print — which app to use

One workflow, different apps depending on where you are.

| App | Say **`print`** in chat? | How to print |
|-----|--------------------------|--------------|
| **Cursor** (PC, local) | Yes | Enable `voice-print` in `~/.cursor/mcp.json` → chat **`print`** |
| **VS Code + Copilot** (PC) | Yes | Start MCP in `.vscode/mcp.json` → Agent mode → **`@voice-print`** or **`print`** |
| **Copilot CLI** (PC) | Yes | `copilot` (loads `.mcp.json`) → type **`print`** |
| **Phone Safari/Chrome** | Tap or say | PC runs `npm start` → open **Phone URL** → **Print** or mic |
| **Cursor mobile app** | No | Cloud — use phone browser row above |
| **GitHub Copilot cloud task** | No | Cloud — use phone browser or PC apps |
| **HP Smart** (phone) | N/A | Manual print; no Cutline blueprint catalog |

## Recommended setup (all apps)

```bash
cd tools/voice-print
cp .env.example .env
npm install
```

**PC chat (Cursor or Copilot):** MCP configs are already in the repo — see [CHAT-PRINT.md](CHAT-PRINT.md).

**Phone:** leave `npm start` running on PC, bookmark the LAN URL on your home screen.

## Printer

- HP OfficeJet Pro 9120 — `192.168.1.157`
- Same Wi‑Fi required for PC and phone

## Docs

- Chat command: [CHAT-PRINT.md](CHAT-PRINT.md)
- Phone quick-start: [docs/VOICE-PRINT-PHONE.md](../../docs/VOICE-PRINT-PHONE.md)
- Copilot agent: [.github/agents/voice-print.agent.md](../../.github/agents/voice-print.agent.md)
