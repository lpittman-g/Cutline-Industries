# Google Cloud / YouTube / Gmail OAuth

One-time setup so Cutline can upload Shorts and send Thermal pitch emails.

## Secrets (never commit)

| File | Purpose |
|------|---------|
| `client_secret.json` | OAuth client ID and client secret (project root) |
| `token.json` | Refresh/access tokens generated after authorization |

Both are gitignored. Cloud agents cannot complete consent for you — run the authorize step on a machine where you can sign in as the Workspace account.

## Configuration

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLOUD_PROJECT` | GCP project id (default in `.env.example`: `utility-mapper-504300-d6`) |
| `GOOGLE_WORKSPACE_SENDER_EMAIL` | From-address for Gmail send (`lpittman@cutline-industries.studio`) |

Copy from `.env.example` into `.env` if missing.

## Console links

| Step | URL |
|------|-----|
| OAuth credentials | https://console.cloud.google.com/apis/credentials?project=utility-mapper-504300-d6 |
| OAuth consent screen | https://console.cloud.google.com/apis/credentials/consent?project=utility-mapper-504300-d6 |
| Enable YouTube Data API | https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=utility-mapper-504300-d6 |
| Enable Gmail API | https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=utility-mapper-504300-d6 |
| OAuth Playground | https://developers.google.com/oauthplayground/ |

## Scopes (must both be granted)

```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube
https://www.googleapis.com/auth/gmail.send
```

Re-authorize if an older `token.json` was created without `gmail.send` — Thermal pitch email will skip otherwise.

## Authorize and save `token.json`

### Option A — Autopilot UI (recommended)

1. Place `client_secret.json` in the project root (Web client; redirect URI `https://developers.google.com/oauthplayground`).
2. Add `lpittman@cutline-industries.studio` as an OAuth test user on the consent screen.
3. `npm run start` → open **/os/autopilot**.
4. Click **Open OAuth** (or use `GET /api/google/oauth/url`).
5. Sign in, allow **YouTube** and **Gmail** scopes.
6. Copy the authorization `code` from the redirect URL / Playground Step 2.
7. Paste the code on Autopilot → **Exchange code** (writes `token.json`), or paste a `refresh_token` and **Save token**.

### Option B — OAuth Playground + refresh token

1. Open [OAuth Playground](https://developers.google.com/oauthplayground/).
2. Gear → **Use your own OAuth credentials** → paste client id/secret from `client_secret.json`.
3. Select the three scopes above → Authorize → Exchange authorization code for tokens.
4. Copy `refresh_token` → Autopilot **Save token**, or:

```bash
# POST refresh_token to the API
curl -s -X POST http://127.0.0.1:8787/api/autopilot/token \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"1//0..."}'
```

### Option C — Local loopback (`npm run auth:youtube`)

Requires a Desktop/Installed OAuth client with redirect `http://127.0.0.1:53682/oauth2callback`, then:

```bash
npm run auth:youtube
```

Opens a local callback and writes `token.json`.

## Verify

```bash
curl -s http://127.0.0.1:8787/api/google/status
curl -s http://127.0.0.1:8787/api/google/youtube/channel
```

Authorized when `oauth.hasClientSecret` and `oauth.hasRefreshToken` are true and channel metadata returns.

## Related

- Autopilot UI: `/os/autopilot`
- API: `server/youtubeAuth.ts`, `server/googleCloud.ts`
- Thermal Gmail pitch: [`THERMAL-MISSION-CONTROL.md`](./THERMAL-MISSION-CONTROL.md)
