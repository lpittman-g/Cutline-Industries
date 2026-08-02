# Thermal

Source of truth: [`THERMAL-BLUEPRINT.json`](./THERMAL-BLUEPRINT.json)

**Thermal** converts stream chat velocity into monetized short-form video.

- Public: `/`, `/bounty`, `/developers`, `/checkout/:clipId`
- Mission Control: `/app/*`
- Cutline engine tools (processing): `/os/*`

Cutline API + FFmpeg is the video processing layer inside Thermal.

## Database

Core schema: [`db/migrations/001_thermal_core.sql`](../db/migrations/001_thermal_core.sql)

```bash
# set DATABASE_URL in .env then:
npm run db:migrate
curl http://127.0.0.1:8787/api/thermal/schema
```
