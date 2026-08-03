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

Stubs (steps 2–6): `/api/sales`, `/api/bounty-posts`, `/api/developers/*`, auth routes.

### Setup

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

## Next steps

2. Stripe Checkout (gateway $15, bounty $50)
3. Bounty post URLs + claim flow
4. S3 persistence (optional)
5. Auth + roles
6. Developer CRM + retainers
