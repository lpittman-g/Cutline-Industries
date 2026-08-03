# Voice Print — say “print” in Cursor chat

Send Cutline docs and blueprints to your **HP OfficeJet Pro 9120** on the local network.

Configured for your printer from the status report:

| Setting | Value |
|---------|--------|
| IP | `192.168.1.157` |
| Host | `HPIAD66D5` |
| Model | HP OfficeJet Pro 9120 Series |

## Quick start — print from chat

**Prefer Cursor** (PC, same Wi‑Fi): one command — **`print`**. Copilot mirrors are optional.

| App | How |
|-----|-----|
| **Cursor** (primary) | MCP in `~/.cursor/mcp.json` → chat **`print`** |
| **Phone Ops bar** | PC `npm start` → `http://<PC-IP>:8791/mobile.html` → **Print** / **⋯** |
| **VS Code Copilot** (optional) | `.vscode/mcp.json` → Agent → **`@voice-print`** or **`print`** |
| **Copilot CLI** (optional) | `copilot` → **`print`** |

Full app matrix: **[APPS.md](APPS.md)** · Shared rules: **[CHAT-PRINT.md](CHAT-PRINT.md)** · Copilot agent: **[.github/agents/voice-print.agent.md](../../.github/agents/voice-print.agent.md)**

1. One-time setup:

```bash
cd tools/voice-print
cp .env.example .env
npm install
```

2. **GitHub Copilot (VS Code)** — configs are in the repo already:
   - Open `.vscode/mcp.json` → click **Start** on `voice-print`
   - Copilot Chat → **Agent** mode → type **`print`**

3. **Copilot CLI** — loads `.mcp.json` / `.github/mcp.json` automatically:

```bash
copilot mcp list    # verify voice-print
copilot             # then type: print
```

4. **Cursor** — add to `~/.cursor/mcp.json` (see `.cursor/mcp.json.example`):

```json
"voice-print": {
  "command": "node",
  "args": ["tools/voice-print/mcp/server.js"],
  "env": {
    "VOICE_PRINT_PRINTER_IP": "192.168.1.157"
  }
}
```

Then in chat type or say **`print`**. Default job: combined blueprint pack. Say **print architecture blueprint** for a specific file.

Full Copilot guide: [`.github/instructions/voice-print.instructions.md`](../../.github/instructions/voice-print.instructions.md)

## Print from your phone

Cursor **mobile/cloud chat cannot reach your printer**. Use this instead:

1. On your **PC** (same Wi‑Fi as HP), leave this running:

```bash
cd tools/voice-print && npm start
```

2. Note the **Phone URL** printed in the terminal, e.g. `http://192.168.1.42:8791`
3. On your **phone** (same Wi‑Fi), open that URL in Safari/Chrome
4. Tap the big **Print** button, or tap **Say “print”** and speak the word

Add the URL to your phone home screen for one-tap access.

## Optional web UI (microphone)

```bash
npm start
```

Open **http://127.0.0.1:8791** if you prefer a browser mic instead of chat.

## CLI (no voice)

```bash
npm run list
npm run print -- docs/architecture-blueprint.html
npm run print -- docs/combined-print.html
```

## Printable catalog

- `docs/architecture-blueprint.html`
- `docs/ai-application-card-blueprint.html` — AI Application Card (Cursor primary)
- `docs/combined-print.html`
- `docs/cover-sheet.html`
- `docs/cutline-4-week-outreach.html`
- `docs/stripe-authorization-letter.html`
- `docs/business/*.pdf` (when present)
- Mission Control / Thermal markdown docs

HTML files are converted to PDF via headless Chrome/Edge before IPP print.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Printer offline | Confirm printer IP at http://192.168.1.157 on your LAN |
| Mic not working | Use Chrome or Edge; allow microphone permission |
| HTML won't print | Install Edge/Chrome; or print a PDF version |
| Cloud agent can't print | Local VS Code / Copilot CLI / Cursor only — not GitHub cloud Copilot |

## Wi‑Fi Direct (optional)

If not on home Wi‑Fi, connect to `DIRECT-D6-HP OfficeJet Pro 9120` using the password on your Wi‑Fi Direct report, then set `VOICE_PRINT_PRINTER_IP` to the Direct IP shown on the printer panel.

## Env vars

See `.env.example`. Root `.env` is also loaded if present.
