# OpenAI Developers plugin (Cursor)

Cutline uses the [OpenAI Developers](https://github.com/openai/openai-developers-for-cursor) Cursor plugin for live OpenAI docs, API key setup guidance, and API troubleshooting. Cloud/mobile agents get the portable skills + Docs MCP from this repo; desktop Cursor should also install the marketplace plugin.

## Install on Cursor desktop

1. Open **Settings → Plugins**.
2. Paste `https://github.com/openai/openai-developers-for-cursor` into the plugin search box.
3. Open **OpenAI Developers** → **Install**.
4. Start a new chat before first use.

Team / Enterprise marketplace import (optional):

1. **Dashboard → Settings → Plugins → Team Marketplaces → Add Marketplace**.
2. **Import from Repo** → `https://github.com/openai/openai-developers-for-cursor`.
3. Install the plugin and grant team access.

## What this repo already wires

| Piece | Location |
|-------|----------|
| OpenAI Docs MCP | `openaiDeveloperDocs` in `.cursor/mcp.json.example` (and mirrors) |
| Docs skill | `.cursor/skills/openai-docs/` |
| API key skill | `.cursor/skills/openai-platform-api-key/` |
| Troubleshooting skill | `.cursor/skills/openai-api-troubleshooting/` |
| Agents SDK skill | `.cursor/skills/agents-sdk/` |
| ChatGPT Apps skills | `.cursor/skills/build-chatgpt-app/`, `chatgpt-app-submission/` |

Copy `.cursor/mcp.json.example` → `~/.cursor/mcp.json` (merge if you already have servers), then restart Cursor. Cloud agents already use the vendored skills + HTTP Docs MCP when egress allows.

Docs MCP URL: `https://developers.openai.com/mcp?source=cursor`

## Cutline env

AI video pipeline uses optional OpenAI credentials in `.env`:

```bash
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_TTS_MODEL=tts-1
# OPENAI_TTS_VOICE=onyx
```

Do not commit keys. For setup help in chat: ask to set up `OPENAI_API_KEY` for this repo (uses `openai-platform-api-key`).

## Verify

After install (or after enabling Docs MCP), ask Cursor:

1. `what is the newest OpenAI model?`
2. `write a small Responses API example`
3. `help me set up OPENAI_API_KEY for this repo`

Docs answers should go through `openaiDeveloperDocs`. Live API calls need a local `OPENAI_API_KEY`.

## Upstream

- Plugin source: [openai/openai-developers-for-cursor](https://github.com/openai/openai-developers-for-cursor)
- Docs index: [developers.openai.com](https://developers.openai.com/)
- Full marketplace docs: [OpenAI Developers plugin](https://developers.openai.com/codex/plugins/openai-developers)

Vendored skills under `.cursor/skills/openai-*` track the Cursor plugin pack (Apache-2.0). Prefer the marketplace plugin on desktop so Agents SDK / ChatGPT Apps skills stay current; refresh vendored copies when upgrading guidance.
