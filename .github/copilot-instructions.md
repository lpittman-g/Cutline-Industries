# Cutline Industries — GitHub Copilot instructions

## Voice Print — shared with Cursor

Follow [tools/voice-print/CHAT-PRINT.md](../tools/voice-print/CHAT-PRINT.md).

**Copilot:** use custom agent **`@voice-print`** (`.github/agents/voice-print.agent.md`).

When the user says **`print`**:

1. MCP tool **`print`** (default: `docs/combined-print.html`)
2. Fallback: `cd tools/voice-print && npm run print -- docs/combined-print.html`

**Apps matrix:** [tools/voice-print/APPS.md](../tools/voice-print/APPS.md) — cloud/mobile cannot reach the HP; phone uses LAN web UI.

## Repo tools

| Tool | Purpose |
|------|---------|
| `tools/voice-print` | IPP print to HP OfficeJet via MCP `print` |
| `tools/phone-approval-lite` | ntfy + web device approval |
| Thermal Mission Control | `npm run start` — API `:8787`, UI `:5173` |
