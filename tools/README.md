# Agent tools

**Use Cursor for all repo work** — [`.cursor/README.md`](../.cursor/README.md) · [`docs/CURSOR-PRIMARY.md`](../docs/CURSOR-PRIMARY.md). Copilot configs are optional mirrors.

## Phone approval — **Cutline lite (default)**

**No Apple Developer.** No serial numbers. No $99/yr.

| Step | Action |
|------|--------|
| 1 | Optionally set `CUTLINE_NTFY_TOPIC` in `.env` (or let the API generate one) |
| 2 | Install **ntfy** on iPhone → subscribe to your topic |
| 3 | Bookmark **/approve** → Add to Home Screen |
| 4 | Enable MCP below |

```bash
cd tools/phone-approval-lite && npm install
npm run send-test   # fires test push (API must be running)
```

**Setup:** [`phone-approval-lite/docs/SETUP-NO-APPLE-DEV.md`](phone-approval-lite/docs/SETUP-NO-APPLE-DEV.md)

**MCP:** `tools/phone-approval-lite/mcp/server.js`

### MCP configuration (copy to `~/.cursor/mcp.json`)

See [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) — use **`phone-approval-lite`**, not Apple APNs.

Cloud Agent absolute path example:

`/agent/spawn-channel/tools/phone-approval-lite/mcp/server.js`

---

## Excel MCP (sister repo)

Spreadsheet automation for revenue ledgers, deal desk exports, and developer pitch packets.

- Fork: https://github.com/lpittman-g/mcp-server-excel
- Integration guide: [`docs/cutline-integration.md`](https://github.com/lpittman-g/mcp-server-excel/blob/main/docs/cutline-integration.md)
- Set `CUTLINE_API_URL=http://127.0.0.1:8787` when using Excel MCP alongside Mission Control

---

## phone-approval-apple (archived — not used)

Requires paid Apple Developer Program + Mac/Xcode. **We are not using this path.**

Kept in repo for reference only. Use **phone-approval-lite** instead.

---

## Voice Print (optional)

Local PC only — chat **`print`**. See [voice-print/README.md](voice-print/README.md).

---

## OpenAI Developers (docs MCP + skills)

Live OpenAI docs via HTTP MCP `openaiDeveloperDocs`, plus portable skills under `.cursor/skills/openai-*`.

- Guide: [`docs/OPENAI-DEVELOPERS-PLUGIN.md`](../docs/OPENAI-DEVELOPERS-PLUGIN.md)
- Desktop plugin: `https://github.com/openai/openai-developers-for-cursor`

---

## email-to-cursor

Forward email to `cursor@cutline-industries.studio` → triggers a Cursor Cloud Agent run.

Setup: [`email-to-cursor/docs/SETUP.md`](email-to-cursor/docs/SETUP.md)

---

## cursor-env (environment view CLI)

View `.cursor/environment.json` + local Postgres/API/Vite status from the terminal — no rebuild needed.

```bash
npm run env:view
npm run env:view -- --json
npm run env:view -- open      # dashboard URL
npm run env:view -- agents    # needs CURSOR_API_KEY
```

Docs: [`cursor-env/README.md`](cursor-env/README.md)
