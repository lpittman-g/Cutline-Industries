# Voice Print — say “print” in Cursor chat

Send Cutline docs and blueprints to your **HP OfficeJet Pro 9120** on the local network.

Configured for your printer from the status report:

| Setting | Value |
|---------|--------|
| IP | `192.168.1.157` |
| Host | `HPIAD66D5` |
| Model | HP OfficeJet Pro 9120 Series |

## Quick start — print from chat

1. **Local Cursor only** (same Wi‑Fi as the printer — cloud agents cannot reach it)
2. One-time setup:

```bash
cd tools/voice-print
cp .env.example .env
npm install
```

3. Add to `~/.cursor/mcp.json` (or copy from repo `.cursor/mcp.json.example`):

```json
"voice-print": {
  "command": "node",
  "args": ["tools/voice-print/mcp/server.js"],
  "env": {
    "VOICE_PRINT_PRINTER_IP": "192.168.1.157"
  }
}
```

4. Open this repo in **Cursor on your PC**, start a chat, and type or say:

**`print`**

The agent sends the default combined print pack to your HP. Say **print architecture blueprint** to pick a specific file.

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
| Cloud agent can't print | This tool must run **on your PC**, not in Cursor Cloud |

## Wi‑Fi Direct (optional)

If not on home Wi‑Fi, connect to `DIRECT-D6-HP OfficeJet Pro 9120` using the password on your Wi‑Fi Direct report, then set `VOICE_PRINT_PRINTER_IP` to the Direct IP shown on the printer panel.

## Env vars

See `.env.example`. Root `.env` is also loaded if present.
