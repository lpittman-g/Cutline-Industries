# Cutline Industries

Gaming media studio app: cut VODs into YouTube Shorts, build packs, and run Autopilot uploads.

**Domain:** [cutline-industries.studio](https://cutline-industries.studio)

## Quick start

```bash
npm install
cp .env.example .env
npm run start          # UI + API
```

- Studio UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

```bash
npm run autopilot      # watch inbox/ and process forever
npm run autopilot:once # process inbox once
```

## YouTube (one-time)

1. Put OAuth client JSON in `client_secret.json` (Web client with Playground redirect for phone auth).
2. Enable YouTube Data API v3 on the Google Cloud project.
3. Add your Gmail as an OAuth **test user**.
4. Authorize in [OAuth Playground](https://developers.google.com/oauthplayground/) with YouTube upload scopes.
5. Paste `refresh_token` into **Autopilot** in the UI (or save `token.json`).

Default uploads are **private** until you set `CUTLINE_PRIVACY=public` in `.env`.

## Connect cutline-industries.studio

1. Deploy the Vite `dist/` site (Vercel, Netlify, or AWS S3+CloudFront).
2. In Squarespace Domains for `cutline-industries.studio`, point DNS:
   - **A/CNAME** records your host provides, **or**
   - Use the host’s “add domain” flow and verify
3. Keep Google Workspace email on Squarespace/Google as already set up.

## Folders

| Path | Purpose |
|---|---|
| `inbox/` | Drop raw VODs here for Autopilot |
| `shorts_out/` | Cut vertical Shorts |
| `uploaded/` | Files moved after successful upload |

## Brand

Cutline Industries — gaming content, cut to ship.
