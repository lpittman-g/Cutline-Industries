# Print from Your Phone — Quick Start

Send Cutline docs to the **HP OfficeJet Pro 9120** (`192.168.1.157`) straight from your phone browser.

> **Limitation:** Cursor mobile and GitHub cloud Copilot agents **cannot** reach the printer — they run in the cloud, not on your home Wi‑Fi. Use this UI instead.

## Steps

1. **On your PC** (same Wi‑Fi as the printer), start the print server:

   ```bash
   cd tools/voice-print
   npm install   # first time only
   npm start
   ```

2. The terminal prints a **Phone URL**, e.g.:

   ```
   Phone URL → http://192.168.1.42:8791
   ```

3. **On your phone** (same Wi‑Fi), open that URL in Safari or Chrome.

4. Tap **Print** (sends the default blueprint pack), or tap **Say "print"** and speak the word.

> **Tip:** Add the URL to your phone's home screen for one-tap access.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Phone URL not shown | Make sure your PC is on the same Wi‑Fi as the printer |
| Can't reach the URL | Check firewall / Windows Defender is allowing port 8791 |
| Printer offline | Visit `http://192.168.1.157` on your LAN to verify the printer |
| Mic not working | Use Chrome or Safari; allow microphone permission when prompted |

## Related

- Full tool docs: [`tools/voice-print/README.md`](../tools/voice-print/README.md)
- Copilot chat command: [`.github/copilot-instructions.md`](../.github/copilot-instructions.md)
