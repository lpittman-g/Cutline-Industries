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
    APNs[phone-approval-apple MCP]
    Email[email-to-cursor]
  end

  Site --> API
  Feedback --> API
  AI --> FB
  FB --> YT
  VOD --> YT
  AI --> YT
  VOD --> GCP
  AI --> GCP
  Site --> AWS
  APNs --> iPhone[iPhone ApprovalPing]
  Email --> Cursor[Cursor Cloud Agent]
```

## Directory map

| Path | Description |
|------|-------------|
| `src/` | React + Vite frontend |
| `server/` | Express backend, autopilots, AI pipeline |
| `scripts/` | Python/Shell automation |
| `synthlang/` | SynthLang autopilot JSON config |
| `tools/phone-approval-apple/` | APNs MCP + iOS ApprovalPing app source |
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

## Apple Developer (in progress)

- Bundle ID: `studio.cutlineindustries.approvalping`
- iOS app source: `tools/phone-approval-apple/ios/ApprovalPing/`
- Setup: `tools/phone-approval-apple/docs/APPLE-DEVELOPER-SETUP.md`

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
