# Voice Print — say “print” to store blueprints

Send Cutline docs and blueprints to your **HP OfficeJet Pro 9120** on the local network.

Configured for your printer from the status report:

| Setting | Value |
|---------|--------|
| IP | `192.168.1.157` |
| Host | `HPIAD66D5` |
| Model | HP OfficeJet Pro 9120 Series |

## Quick start (same Wi‑Fi as printer)

```bash
cd tools/voice-print
cp .env.example .env   # edit if your printer IP changes
npm install
npm start
```

Open **http://127.0.0.1:8791**

1. Pick a blueprint from the dropdown  
2. Click **Start listening for “print”**  
3. Allow microphone access (Chrome or Edge)  
4. Say **“print”** — the selected file goes to the HP  

Use **Print now** if you prefer not to use voice.

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
