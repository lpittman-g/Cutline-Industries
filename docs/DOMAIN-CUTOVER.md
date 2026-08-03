# Domain cutover — cutline-industries.studio → Amplify

**Project name:** Cutline Industries  
**Domain:** `cutline-industries.studio` (Squarespace registrar)  
**App host:** AWS Amplify (staging app `dlbg4dsrs0mjb`, us-east-2)  
**Do not** build the Vite/React app inside Squarespace Site Builder. Use Squarespace only as the DNS/domain home until (or unless) you move nameservers to Route 53.

## What “Create or connect a website” means

On Squarespace Domains you will see setup steps (often 2/4). For this repo:

1. Skip “Create a Squarespace website.”
2. Connect the domain to **Amplify** (or Route 53 → Amplify) via DNS.

After cutover, the live site is this repo’s build: Cutline Industries landing, Mission Control (`/app`), and the project terminal (`/terminal` → `/os/command`).

## Option A — Point Squarespace DNS at Amplify (simplest)

1. In **AWS Amplify** → app `dlbg4dsrs0mjb` → **Hosting** → **Custom domains** → add `cutline-industries.studio` (and `www` if you want).
2. Amplify shows the records it needs (usually a root ALIAS/A or CNAME to the Amplify cloudfront domain, plus ACM validation CNAMEs).
3. In **Squarespace Domains** → DNS settings for `cutline-industries.studio`, add those records exactly.
4. Wait for Amplify domain status → **Available**.
5. Smoke-test:
   - `https://cutline-industries.studio/` — Cutline Industries landing
   - `https://cutline-industries.studio/terminal` — Command terminal
   - `https://cutline-industries.studio/app/dashboard` — Mission Control

## Option B — Move nameservers to Route 53

Use when you want AWS-owned DNS (matches README “Route 53 + Amplify”).

1. Create or open the hosted zone for `cutline-industries.studio` in Route 53.
2. In Amplify, associate the domain; Amplify can write validation + alias records into that zone.
3. In Squarespace Domains → nameservers, replace Squarespace NS with the four Route 53 nameservers.
4. Keep Squarespace as registrar only (renewal/billing); DNS is Route 53.

## App routes on this domain

| URL | Purpose |
|-----|---------|
| `/` | Cutline Industries public landing (Thermal product) |
| `/terminal` | Alias → Cutline OS Command Center |
| `/os/*` | Creator OS / internal terminal |
| `/app/*` | Thermal Mission Control |
| `/bounty`, `/developers` | Public product pages |

SPA deep links require the Amplify `customRules` in [`amplify.yml`](../amplify.yml) (already in repo).

## Checklist

- [ ] Amplify custom domain added + SSL issued
- [ ] Squarespace DNS (or Route 53 NS) updated
- [ ] `/` shows **Cutline Industries** in title and hero
- [ ] `/terminal` loads Command Center
- [ ] AdSense / GA still fire on the Amplify host
- [ ] Email `lpittman@cutline-industries.studio` unchanged (Google Workspace / Squarespace email is separate from site hosting)
