# Cutline Industries — GitHub Copilot instructions

## Voice Print — say **print** in chat

When the user message is **only** `print` (case-insensitive), or clearly means "print this now":

1. Call the **voice-print** MCP tool `print` with no `file` argument (default: `docs/combined-print.html`).
2. If MCP is unavailable, run locally:
   ```bash
   cd tools/voice-print && npm run print -- docs/combined-print.html
   ```
3. Confirm what was sent and the printer IP (`192.168.1.157`).

Variations:

- **print architecture blueprint** → `print` with `file: docs/architecture-blueprint.html`
- **list printables** → `list_printables`

**Local only:** VS Code Copilot, Copilot CLI, or Cursor on the same Wi‑Fi as the HP OfficeJet. GitHub **cloud** Copilot agents cannot reach the printer on your LAN.

Setup: [`tools/voice-print/README.md`](../tools/voice-print/README.md) and [`.github/instructions/voice-print.instructions.md`](instructions/voice-print.instructions.md).

## Repo tools

| Tool | Purpose |
|------|---------|
| `tools/voice-print` | IPP print to HP OfficeJet via MCP `print` |
| `tools/phone-approval-lite` | ntfy + web device approval (no Apple Dev account) |
| Thermal Mission Control | `npm run start` — API `:8787`, UI `:5173` |
