# Ramp (demo) — Cutline integration

Cutline talks to the **Ramp Developer API** on demo by default (`RAMP_ENV=demo`).

## Goals covered

| Goal | How |
|------|-----|
| Explore data | `GET /api/ramp/transactions` paginates demo transactions |
| Ramp in Cursor | Add demo MCP URL (see below) — authenticate in **Cursor desktop** |
| Build into Cutline | Server client + Mission Control **Ramp spend** page |
| Auth code | Public `/callback` + `POST /api/ramp/oauth/exchange` |

## Env (`.env` — never commit secrets)

```bash
RAMP_ENV=demo
RAMP_CLIENT_ID=ramp_id_…
RAMP_CLIENT_SECRET=ramp_sec_…
RAMP_REDIRECT_URI=https://cutline-industries.studio/callback
RAMP_SCOPES=transactions:read
```

Copy placeholders from `.env.example`. Rotate any secret that was pasted in chat.

## Demo Developer app checklist

On [demo.ramp.com → Developer](https://demo.ramp.com):

1. **Client credentials** ON (required for Mission Control auto-load)
2. **Authorization code** ON (for browser authorize → `/callback`)
3. **Refresh token** ON (recommended)
4. Redirect URIs include exactly:
   - `https://cutline-industries.studio/callback`
   - `http://localhost:8400/callback` (optional; CLI-style)
5. Allowed scopes include `transactions:read` (add more as needed)

If API returns `DEVELOPER_7012` / “not authorized to use this authorization grant type”, the matching grant toggle is off — turn it back on.

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ramp/status` | Config + env |
| GET | `/api/ramp/transactions` | List + sum (paginated) |
| GET | `/api/ramp/oauth/url` | Build authorize URL |
| POST | `/api/ramp/oauth/exchange` | `{ "code": "…" }` → store token |

UI: `/app/ramp` (Mission Control). Callback: `/callback`.

## Cursor Ramp MCP (demo)

Cloud agents cannot complete interactive MCP login. On **Cursor desktop**, add to `~/.cursor/mcp.json` (or Cursor Settings → MCP):

```json
"Ramp": {
  "url": "https://demo-mcp.ramp.com/mcp"
}
```

Then authenticate when prompted. Production MCP is `https://mcp.ramp.com/mcp` (needs a live Ramp account).

Repo example: `.cursor/mcp.json.example`.

## Hosts

| | Demo | Production |
|--|------|------------|
| Dashboard | `demo.ramp.com` | `app.ramp.com` |
| API | `demo-api.ramp.com` | `api.ramp.com` |
| MCP | `demo-mcp.ramp.com/mcp` | `mcp.ramp.com/mcp` |

This repo stays on **demo** until you set `RAMP_ENV=production` and production credentials.
