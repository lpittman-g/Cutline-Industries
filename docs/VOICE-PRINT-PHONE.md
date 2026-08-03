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

3. **On your phone** (same Wi‑Fi), open the **Ops bar** (bottom Print button — same spot as Cursor chat toolbar):

   ```
   http://192.168.1.42:8791/mobile.html
   ```

4. Tap **Print** in the bottom bar, or tap **🎤** and say **print**.
5. Use **◀ / ▶** to cycle printables. Tap **⋯** for: refresh catalog, select **AI Application Card**, show list, or open Mission Control.

> **Tip:** Safari → Share → **Add to Home Screen** for a Cutline Ops app with the Print button always at the bottom.

> **Cursor only:** Cloud/mobile Cursor chat cannot reach the LAN printer — this Ops bar on your phone + PC `npm start` is the path. Copilot is optional.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Phone URL not shown | Make sure your PC is on the same Wi‑Fi as the printer |
| Can't reach the URL | Check firewall / Windows Defender is allowing port 8791 |
| Printer offline | Visit `http://192.168.1.157` on your LAN to verify the printer |
| Mic not working | Use Chrome or Safari; allow microphone permission when prompted |

## Related

- **Apps (Cursor, Copilot, phone):** [`tools/voice-print/APPS.md`](../tools/voice-print/APPS.md)
- Full tool docs: [`tools/voice-print/README.md`](../tools/voice-print/README.md)
- Copilot agent `@voice-print`: [`.github/agents/voice-print.agent.md`](../.github/agents/voice-print.agent.md)
