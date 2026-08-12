# Squarespace — cutline-industries.studio

**Site URL:** https://www.cutline-industries.studio  
**Commerce API:** Developer API key in `SQUARESPACE_API_KEY` (gitignored `.env`)

## What the API can do

Squarespace **Commerce** APIs (wired in Cutline):

| Endpoint | Purpose |
|----------|---------|
| `GET /api/squarespace/status` | Website id, title, URL + public/private probe |
| `GET /api/squarespace/products` | Catalog summary (name, URL, visibility) |

Underlying Squarespace routes: `/1.0/authorization/website`, `/1.0/commerce/products`, plus orders/inventory/profiles when needed.

## What it cannot do

The Commerce API **does not host or deploy** the Cutline Vite/Express SPA. It cannot replace Amplify/Route 53 for the Creator OS / Thermal app.

Today DNS for `cutline-industries.studio` points at **Squarespace nameservers**, and the live site is a **password-protected** template store (`Private Site`, HTTP 401).

## Hosting the Cutline project on this domain

Intended production edge (see blueprint):

```text
cutline-industries.studio (registrar: Squarespace)
  → custom nameservers / DNS to Route 53
  → AWS Amplify (or other app host) serves Cutline `dist/` + API
```

Until that cutover:

1. Run Cutline in Cursor: `npm run start` (Vite `:5173`, API `:8787`)
2. Keep Squarespace for commerce catalog sync via `SQUARESPACE_API_KEY`
3. When ready to host the SPA on the domain: in Squarespace Domains → **Use custom nameservers** (or DNS records) pointing at Route 53 / Amplify targets from AWS

**Do not flip nameservers until Amplify (or the chosen host) is green** — the domain will stop resolving to Squarespace during cutover.

## Env

```bash
SQUARESPACE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SQUARESPACE_SITE_URL=https://www.cutline-industries.studio
CUTLINE_PUBLIC_URL=https://cutline-industries.studio
```

Generate keys: Squarespace site → **Developer tools** → **Developer API Keys** → name e.g. `Cursor`.  
Prefer least privilege; store only in secrets / `.env` (never commit).

## Site checklist

- [ ] Turn off Squarespace **Private site** / password wall when ready for public traffic
- [ ] Rename site title from template (“Your Site Title”) to **Cutline Industries**
- [ ] Replace sample merch with Cutline merch / packs (or delete template products)
- [ ] Confirm DNS cutover plan (keep Squarespace storefront vs host Cutline SPA)
