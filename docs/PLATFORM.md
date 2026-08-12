# Cutline Industries Platform

Monorepo for Lamont Pittman / Cutline Industries — the Thermal product and everything that powers it.

## Products

### Thermal (public)

| Route | Purpose |
|-------|---------|
| `/` | Landing — heat → Shorts → revenue |
| `/bounty` | Public Bounty Board |
| `/developers` | Indie dev retainer engine |
| `/feedback` | Audience input for AI Shorts |
| `/approve` | Agent sign-in approval (no Apple Developer) |
| `/app/*` | Mission Control (internal) |
| `/os/*` | Cutline processing OS (internal) |

### Content engines

1. **VOD Autopilot** — `inbox/*.mp4` → FFmpeg vertical cuts → YouTube Shorts
2. **AI video pipeline** — trend/feedback → script → TTS → render → YouTube (project-mode Thermal Shorts)
3. **SynthLang CI** — autonomous verification loop on every PR/push

## Architecture

```mermaid
flowchart TB
  subgraph public [Public]
    Site[Thermal Web App]
    Feedback[/feedback]
  end

  subgraph server [Node API]
    API[Express API]
    VOD[VOD Autopilot]
    AI[AI Video Pipeline]
    FB[YouTube Feedback Loop]
  end

  subgraph external [External]
    YT[YouTube]
    GCP[Google Cloud]
    AWS[AWS Amplify / Route53 / S3]
  end

  subgraph tools [Agent Tools]
    Approve[phone-approval-lite MCP]
    Email[email-to-cursor]
  end

  Site --> API
  Feedback --> API
  ApprovePage[/approve] --> API
  AI --> FB
  FB --> YT
  VOD --> YT
  AI --> YT
  VOD --> GCP
  AI --> GCP
  Site --> AWS
  Approve --> ntfy[ntfy iOS app]
  Approve --> ApprovePage
  Email --> Cursor[Cursor Cloud Agent]
```

## Directory map

| Path | Description |
|------|-------------|
| `src/` | React + Vite frontend |
| `server/` | Express backend, autopilots, AI pipeline |
| `scripts/` | Python/Shell automation |
| `synthlang/` | SynthLang autopilot JSON config |
| `tools/phone-approval-lite/` | **Default** — ntfy + `/approve` (no Apple Dev) |
| `tools/phone-approval-apple/` | Archived — APNs path (not used) |
| `tools/email-to-cursor/` | Gmail Apps Script → Cursor webhook |
| `docs/` | Technical documentation |
| `docs/business/` | Blueprint PDFs, outreach plan, Stripe letter |
| `infra/aws/` | AWS pipeline skeleton |
| `db/migrations/` | Thermal Postgres schema |

## Environment

Copy `.env.example` → `.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLOUD_PROJECT` | GCP project for YouTube / Gmail OAuth |
| `GOOGLE_WORKSPACE_SENDER_EMAIL` | From-address for Gmail send |
| `CUTLINE_AI_MODE` | `project` (Thermal Shorts) or `trends` (Reddit) |
| `CUTLINE_AI_PRIVACY` | `public` for AI Shorts |
| `OPENAI_API_KEY` | Optional — better AI scripts |
| `DATABASE_URL` | Thermal Postgres (user+password in URI; SSL for Neon/Supabase/RDS) |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Optional — Helix live poll ([console](https://dev.twitch.tv/console/apps), [register](https://dev.twitch.tv/docs/authentication/register-app)) |
| `DISCORD_HEAT_WEBHOOK_URL` | Optional — heat + clip-drop webhooks (Server Settings → Integrations → Webhooks → Create Webhook → Copy Webhook URL) |
## Google Cloud

- Account: `lpittman@cutline-industries.studio`
- Project: `utility-mapper-504300-d6`
- APIs: YouTube Data API v3, Gmail API (`gmail.send`), OAuth
- Secrets: `client_secret.json`, `token.json` (gitignored)
- Setup: [`docs/GOOGLE-OAUTH.md`](./GOOGLE-OAUTH.md)

## Squarespace

- Domain registrar + current DNS: `cutline-industries.studio` (Squarespace nameservers)
- Live site: password-protected template store until cutover / publish
- Commerce API key: `SQUARESPACE_API_KEY` → `GET /api/squarespace/status` + `/api/squarespace/products`
- Setup: [`docs/SQUARESPACE.md`](./SQUARESPACE.md)
- SPA hosting still targets Amplify + Route 53 (DNS cutover pending)

## AWS

- Account: `583968735276`
- IAM: `cursor-thermal-deploy`
- Services: Amplify (staging), Route 53 (DNS ready), S3 (media)
- Clip bucket env: `AWS_S3_BUCKET_NAME` (recommended: `thermal-video-clips`)
- Clean masters stay private; paid buyers receive 15-minute presigned URLs
- Preview MP4 + thumbnail use `AWS_CLOUDFRONT_DOMAIN` when configured
- Never commit AWS, Stripe, or OpenAI keys; inject them as deployment secrets
- Prefer an **IAM role** on the host (EC2/ECS/Lambda/Amplify) instead of permanent access keys

### Clip storage env

| Variable | Kind | Notes |
|----------|------|-------|
| `AWS_ACCESS_KEY_ID` | secret | Local/dev only; omit when using an IAM role |
| `AWS_SECRET_ACCESS_KEY` | secret | Local/dev only; omit when using an IAM role |
| `AWS_REGION` | config | e.g. `us-east-1` |
| `AWS_S3_BUCKET_NAME` | config | recommended: `thermal-video-clips` |
| `AWS_CLOUDFRONT_DOMAIN` | config (optional) | CDN base URL for previews + thumbs |

Console links:

- [Create IAM user / access key](https://console.aws.amazon.com/iam/home#/users)
- [S3 buckets](https://s3.console.aws.amazon.com/s3/buckets)
- [CloudFront distributions](https://console.aws.amazon.com/cloudfront/v4/home#/distributions)

### AWS CLI (ops / bootstrap)

Local bucket helpers (`scripts/aws/media_bootstrap.sh`) need **AWS CLI v2**. Follow [docs/AWS-CLI.md](./AWS-CLI.md) (prerequisites → install → `aws configure`). Official guide: [Getting started with the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html). The Thermal API uses the SDK and does not require the CLI.

### Production secrets

| Secret | Used by |
|--------|---------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (optional) | S3 media uploads when no IAM role |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout + fulfillment |
| `RAMP_CLIENT_ID`, `RAMP_CLIENT_SECRET` | Demo Ramp spend API ([docs/RAMP.md](./RAMP.md)) |
| `SQUARESPACE_API_KEY` | Squarespace Commerce for cutline-industries.studio ([docs/SQUARESPACE.md](./SQUARESPACE.md)) |
| `OPENAI_API_KEY` | AI video pipeline |
| `DATABASE_URL` | Thermal state + auth (Neon / Supabase / RDS; use SSL in production) |
| `AUTH_BOOTSTRAP_ADMIN_EMAIL` | Initial Mission Control admin |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Twitch Helix monitor (`server/twitchMonitor.ts`) |
| `DISCORD_HEAT_WEBHOOK_URL` | Heat alerts + $15 live clip drops (`server/discordNotify.ts`) |
`npm audit` currently reports an RSC-only React Router advisory. This frontend
is a Vite SPA and does not use React Server Components or server actions; the
repo stays on the latest router release to retain fixes for older XSS advisories.

## Phone approval (Cutline lite — no Apple Developer)

- **Push:** ntfy iOS app (free)
- **Approve UI:** `/approve` on cutline-industries.studio
- **MCP:** `phone-approval-lite`
- Setup: `tools/phone-approval-lite/docs/SETUP-NO-APPLE-DEV.md`

We do **not** use Apple Developer / APNs for agent approvals.

## Apple Developer (not used)

- Bundle ID (archived): `studio.cutlineindustries.approvalping`
- See `tools/phone-approval-apple/` — reference only

## CI/CD

`.github/workflows/synthlang-pipeline.yml`:

1. Lint (`oxlint`)
2. Typecheck (`tsc`)
3. Unit tests
4. Build (`vite build`)
5. Upload `dist/` artifact on `main`

## Related links

- GitHub: https://github.com/lpittman-g/Cutline-Industries
- Staging: Amplify app `dlbg4dsrs0mjb` (us-east-2)
- Domain: cutline-industries.studio
