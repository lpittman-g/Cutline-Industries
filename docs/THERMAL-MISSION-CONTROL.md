# Thermal Mission Control — production loop

Real-time media ops: **detection → clip → distribute → pay → retain**

## Step 1 (implemented): Heat → clip pipeline

### Flow

```
Twitch monitor (or manual trigger)
  → heat_spikes row (detected)
  → FFmpeg cut + watermark + thumbnail
  → clips row (media_url, thumbnail_url)
  → optional Discord webhook
  → Mission Control UI updates
```

### API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/streamers` | GET | Tracked streamers + live velocity |
| `/api/heat-events` | GET | Recent heat events |
| `/api/heat-events` | POST | Trigger heat → clip (`{ streamerId }`) |
| `/api/clips` | GET | Clip vault with media URLs |
| `/api/clips/top` | GET | Top clips |
| `/api/dashboard/summary` | GET | Heat toast + KPIs |

## Step 2 (implemented): Stripe Checkout + sales ledger

### Flow

```
Claim CTA → POST /api/checkout/session
  → Stripe Hosted Checkout
  → webhook checkout.session.completed (or /api/checkout/confirm on success redirect)
  → clips.status = claimed, sales row completed
  → Revenue dashboard + timeline update
```

### API routes (added)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/clips/:id` | GET | Single clip for checkout page |
| `/api/bounty/clips` | GET | Public bounty board clips |
| `/api/checkout/session` | POST | Create Stripe Checkout (`{ clipId }`) |
| `/api/checkout/confirm` | POST | Confirm session after redirect (dev fallback) |
| `/api/stripe/webhook` | POST | Stripe webhook (raw body) |
| `/api/sales` | GET | Sales ledger |
| `/api/dashboard/revenue-timeline` | GET | Revenue by day + tier |

### Stripe env

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # stripe listen --forward-to localhost:8787/api/stripe/webhook
THERMAL_PUBLIC_URL=http://127.0.0.1:5173
# Optional: STRIPE_PRICE_GATEWAY, STRIPE_PRICE_BOUNTY
```

Without `STRIPE_SECRET_KEY`, checkout returns 503; seed/demo UI still loads.

## Step 3 (implemented): Bounty distribution

### Flow

```
Clip ready → POST /api/bounty-posts (queue X/TikTok)
  → ops mark posted with real postUrl
  → public /bounty shows posted bounties
  → claim via Stripe Checkout ($50)
```

### API routes (added)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/bounty-posts` | GET | All bounty posts with clip metadata |
| `/api/bounty-posts` | POST | Queue clip `{ clipId, platform: x\|tiktok }` |
| `/api/bounty-posts/:id` | PATCH | Update views/engagement |
| `/api/bounty-posts/:id/mark-posted` | POST | Set postUrl + posted status |

Mission Control: `/app/bounty` — queue, mark posted, update metrics.

## Step 4 (implemented): Indie Dev CRM + retainers (Tier 3)

### Flow

```
Mission Control /app/developers or public /developers
  → retainers row (prospect)
  → advance to sample_sent
  → POST /api/developers/:id/checkout (Stripe subscription)
  → webhook / confirm → status active + sales tier=retainer
  → Revenue ledger includes retainer MRR
```

### API routes (added)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/developers` | GET | Retainer CRM list (seeds demo leads if empty) |
| `/api/developers/pipeline` | GET | Counts by status |
| `/api/developers` | POST | Create prospect `{ devName, gameTitle, monthlyMrr? }` |
| `/api/developers/:id` | GET / PATCH | Read / update status, MRR, contact |
| `/api/developers/:id/checkout` | POST | Stripe subscription Checkout |
| `/api/developers/checkout` | POST | Public: create prospect + Checkout |

Statuses: `prospect` → `sample_sent` → `active` (or `cancelled`).

### Stripe env (retainer)

```bash
STRIPE_PRICE_RETAINER=price_...   # optional recurring Price
# STRIPE_RETAINER_AMOUNT_CENTS=75000
```

Without `STRIPE_SECRET_KEY`, retainer checkout returns 503; CRM CRUD still works.

## Step 5 (implemented): Auth signup / sign-in

Config: [`server/auth/auth.config.json`](../server/auth/auth.config.json)

| Rule | Value |
|------|-------|
| Email verification | required |
| Public registration | allowed |
| Blocked domains | tempmail.com, throwaway.com |
| Password | min 8, upper, number, special |
| Lockout | 5 attempts / 15 min |
| Session | 24h cookie |
| MFA | optional |

Routes: `/signup`, `/signin`, `/verify-email` · API `/api/auth/*`

```bash
npm run db:migrate   # applies 006_thermal_auth.sql
```

## Step 6 (implemented): Mission Control roles + S3 persistence

### Mission Control access

- `/app/*` requires `operator` or `admin`
- New signups default to `user`
- `AUTH_BOOTSTRAP_ADMIN_EMAIL` makes the matching signup an admin
- Admin role API: `POST /api/auth/users/:id/role`
- Local-only bypass: `AUTH_MC_OPEN=1`

### S3 media flow

```
FFmpeg local render
  → clean.mp4 (private S3)
  → preview.mp4 + thumb.jpg (S3 / CloudFront)
  → clips row stores S3 URIs and public preview URLs
  → paid checkout session → 15-minute presigned clean download
```

Required deployment secrets:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=thermal-video-clips
AWS_CLOUDFRONT_DOMAIN=https://clips.example.com # optional
AUTH_BOOTSTRAP_ADMIN_EMAIL=lpittman@cutline-industries.studio
```

If AWS variables are blank, the pipeline falls back to local `thermal_media/`.

## Step 7 (implemented): AI heat autopilot

After FFmpeg + S3 completes, `thermalHeatAutopilot.ts`:

1. Generates factual Discord, X/TikTok, and developer pitch copy with OpenAI
2. Falls back to deterministic copy when `OPENAI_API_KEY` is absent
3. Sends the $15 live-unlock drop to Discord
4. Queues separate X and TikTok bounty posts (manual/API publish remains)
5. Looks up a matching developer contact and sends the sample pitch with Gmail
6. Persists generated copy, completion state, and errors on the clip

No cron “keep alive” task is used. The existing Twitch monitor polls for live
heat while the API process is running; production uptime belongs to the hosting
service.

```bash
OPENAI_API_KEY=...
OPENAI_THERMAL_MODEL=gpt-4o-mini
GOOGLE_WORKSPACE_SENDER_EMAIL=lpittman@cutline-industries.studio
```

Google OAuth must be re-authorized once with the `gmail.send` scope before the
pitch email step can send. Missing credentials skip/fail that channel without
losing the rendered clip.

## Next steps

8. Production Twitch credentials and Kick adapter
9. Discord bot OAuth (webhook delivery is implemented)
10. X/TikTok publishing APIs (queue + copy are implemented)

```bash
# Postgres
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/thermal
npm run db:migrate

# Optional Twitch (credentialed mode)
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

# Optional Discord heat alerts
DISCORD_HEAT_WEBHOOK_URL=

# VOD source for clips when live VOD unavailable
# Uses inbox/cutline_test_vod.mp4 by default
```

```bash
npm run start   # UI + API
```

### Mission Control

- **Streams** — live velocity, **Force heat spike** → real clip
- **Dashboard** — real heat toast from latest `heat_spikes` row
- **Clips** — thumbnails + video playback from `/thermal-media/`
- **Developers** — retainer CRM + Stripe subscription checkout
- **Revenue** — gateway / bounty / retainer ledger

### Media storage

Clips stored under `thermal_media/clips/{spikeId}/` and served at `/thermal-media/...`.

### Setup

#### Discord

- `DISCORD_HEAT_WEBHOOK_URL`

There is no standalone credential dashboard. In Discord:

1. Open the server that should receive heat alerts and $15 clip drops.
2. **Server Settings → Integrations → Webhooks** (or **Edit Channel → Integrations → Webhooks**).
3. **New Webhook** → name it (e.g. `Thermal Heat`) → pick the target channel.
4. **Copy Webhook URL** (`https://discord.com/api/webhooks/...`).
5. Paste into `.env`:

```bash
DISCORD_HEAT_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Used by `server/discordNotify.ts` for heat detection and live clip-drop posts. If unset, Discord steps are skipped and the clip pipeline continues.
