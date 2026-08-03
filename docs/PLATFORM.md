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
| `GOOGLE_CLOUD_PROJECT` | GCP project for YouTube OAuth |
| `CUTLINE_AI_MODE` | `project` (Thermal Shorts) or `trends` (Reddit) |
| `CUTLINE_AI_PRIVACY` | `public` for AI Shorts |
| `OPENAI_API_KEY` | Optional — better AI scripts |
| `DATABASE_URL` | Thermal Postgres |

## Google Cloud

- Account: `lpittman@cutline-industries.studio`
- Project: `utility-mapper-504300-d6`
- APIs: YouTube Data API v3, OAuth

## AWS

- Account: `583968735276`
- IAM: `cursor-thermal-deploy`
- Services: Amplify (staging), Route 53 (DNS ready), S3 (media)
- Clip bucket env: `AWS_S3_BUCKET_NAME` (recommended: `thermal-video-clips`)
- Clean masters stay private; paid buyers receive 15-minute presigned URLs
- Preview MP4 + thumbnail use `AWS_CLOUDFRONT_DOMAIN` when configured
- Never commit AWS, Stripe, or OpenAI keys; inject them as deployment secrets

### Production secrets

| Secret | Used by |
|--------|---------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | S3 media uploads |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout + fulfillment |
| `OPENAI_API_KEY` | AI video pipeline |
| `DATABASE_URL` | Thermal state + auth |
| `AUTH_BOOTSTRAP_ADMIN_EMAIL` | Initial Mission Control admin |

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
