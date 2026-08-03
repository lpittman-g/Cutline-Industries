# Thermal

Source of truth: [`THERMAL-BLUEPRINT.json`](./THERMAL-BLUEPRINT.json)

**Thermal** converts stream chat velocity into monetized short-form video.

- Public: `/`, `/bounty`, `/developers`, `/checkout/:clipId`
- Mission Control: `/app/*`
- Cutline engine tools (processing): `/os/*`

Cutline API + FFmpeg is the video processing layer inside Thermal.

## Database

Core schema: [`db/migrations/001_thermal_core.sql`](../db/migrations/001_thermal_core.sql)

`DATABASE_URL` must include the database username and password.

| Env | Example |
|-----|---------|
| Local | `postgres://postgres:postgres@127.0.0.1:5432/thermal` |
| Production | Provider connection string with SSL (`?sslmode=require`) |

**Providers (pick one):** [Neon Console](https://console.neon.tech) · [Supabase Dashboard](https://supabase.com/dashboard) · [AWS RDS Console](https://console.aws.amazon.com/rds) — copy the PostgreSQL URI into `DATABASE_URL`. Non-localhost hosts enable SSL automatically via `server/db/pgConfig.ts`.

```bash
# set DATABASE_URL in .env then:
npm run db:migrate
curl http://127.0.0.1:8787/api/thermal/schema
```
