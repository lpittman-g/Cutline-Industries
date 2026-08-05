# Ramp (demo) — Cutline integration

Cutline uses **two separate Ramp surfaces**. Keep them distinct.

## Two apps (do not mix)

| | **A — Developer API** | **B — Cursor / Ramp Agent** |
|--|----------------------|-----------------------------|
| **What** | OAuth app for HTTP API | Cursor connector permissions |
| **Where** | demo.ramp.com → **Company → Developer** | demo.ramp.com → **Cursor** app → **Permissions** |
| **Client ID** | `ramp_id_…` (long id) | Label/id **`cutline`** |
| **Used by** | Cutline server (`/api/ramp/*`, Mission Control **Ramp**) | Cursor desktop MCP (`demo-mcp.ramp.com`) |
| **Secrets** | `RAMP_CLIENT_ID` / `RAMP_CLIENT_SECRET` in `.env` | Browser OAuth in Cursor — no Cutline env secret |
| **Grant types** | Client credentials (+ Auth code / Refresh) | N/A (agent permission checkboxes) |
| **Scopes / perms** | API scopes e.g. `transactions:read` | Agent permissions (reporting, AI fees, approvals, …) |

Mission Control spend data = **App A**.  
Chat agents talking to Ramp via MCP = **App B**.

---

## A — Developer API (Cutline Mission Control)

### Env (`.env` — never commit secrets)

```bash
RAMP_ENV=demo
RAMP_CLIENT_ID=ramp_id_…
RAMP_CLIENT_SECRET=ramp_sec_…
RAMP_REDIRECT_URI=https://cutline-industries.studio/callback
RAMP_SCOPES=transactions:read
```

### Checklist (Developer → your API app)

1. **Client credentials** ON  
2. **Authorization code** ON (for `/callback`)  
3. **Refresh token** ON (recommended)  
4. Redirect URIs exactly:
   - `https://cutline-industries.studio/callback`
   - `http://localhost:8400/callback` (optional)
5. Allowed API scopes include `transactions:read`

`DEVELOPER_7012` → grant type toggle is off — turn it back on.

### API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ramp/status` | Config + env |
| GET | `/api/ramp/transactions` | List + sum (paginated) |
| GET | `/api/ramp/oauth/url` | Build authorize URL |
| POST | `/api/ramp/oauth/exchange` | `{ "code": "…" }` → store token |

UI: `/app/ramp`. Callback: `/callback`.

---

## B — Cursor / Ramp Agent (MCP)

App name **Cursor**, Client ID **`cutline`**, tab **Permissions** on demo.

### Saved permission set (demo)

Keep these **on** (matches Cutline’s intended demo agent access):

| Area | Permission |
|------|------------|
| Banking | Add or modify business bank accounts you’ve connected to Ramp |
| Banking | Add business bank accounts you’ve connected to Ramp |
| Travel | Manage Ramp Travel settings |
| Reporting | View reporting data on admin level |
| AI Fees | View AI provider usage data |
| AI Fees | Manage settings and integrations for AI Fees spent |
| AI Fees | Manage AI provider AI fees |
| AI Fees | Manage AI spent from each individual |
| Approvals | Add approval rules and approval chains |
| Personal Agents | Manage connections to Ramp AI Agent |

Leave **off** unless you explicitly need them: vendor controls, card↔network enablement, Error/Buy Intelligence, book travel for whole company, deposit checks, etc.

On the phone UI: confirm the boxes above → tap **Save changes** (only you can press that in the Ramp session).

### Cursor desktop MCP

Cloud agents cannot finish interactive MCP login. On **Cursor desktop**, `~/.cursor/mcp.json`:

```json
"Ramp": {
  "url": "https://demo-mcp.ramp.com/mcp"
}
```

Repo example: `.cursor/mcp.json.example`. Production MCP: `https://mcp.ramp.com/mcp`.

---

## Hosts

| | Demo | Production |
|--|------|------------|
| Dashboard | `demo.ramp.com` | `app.ramp.com` |
| API | `demo-api.ramp.com` | `api.ramp.com` |
| MCP | `demo-mcp.ramp.com/mcp` | `mcp.ramp.com/mcp` |

Stay on **demo** until `RAMP_ENV=production` + production Developer credentials (App A). App B production needs a live Ramp business.
