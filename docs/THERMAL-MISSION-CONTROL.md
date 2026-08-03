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

## Next steps

4. S3 persistence (optional)
5. Auth + roles
6. Developer CRM + retainers

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

### Media storage

Clips stored under `thermal_media/clips/{spikeId}/` and served at `/thermal-media/...`.

### Setup
