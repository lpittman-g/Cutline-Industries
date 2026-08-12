# AGENTS.md

Repo-wide agent guidance for the Cutline Industries monorepo (flagship product: **Thermal** — turn live-stream heat into monetized Shorts).

Start with `README.md` and `docs/PLATFORM.md` for architecture. Standard commands live in the root `package.json` `scripts` block — use those rather than reinventing them.

## Cursor Cloud specific instructions

Cloud env config lives in `.cursor/environment.json`. The **install** script refreshes npm deps, creates `.env` from `.env.example` when missing, and ensures Postgres packages via `scripts/cloud-postgres.sh ensure`. The **start** script runs `scripts/cloud-postgres.sh start` (cluster + `thermal` DB); the **thermal** terminal runs `npm run db:migrate && npm run start` (API + Vite). Everything below is agent run-time context.

### Services (Thermal core)

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Frontend (Vite SPA) | `npm run dev` | 5173 | Proxies `/api` + `/thermal-media` to the API on 8787 |
| Backend API (Express) | `npm run api` | 8787 | `tsx server/api.ts` |
| Both together | `npm run start` | 5173 + 8787 | `concurrently` runs API + Vite (cloud terminal) |
| PostgreSQL | `bash scripts/cloud-postgres.sh start` | 5432 | System Postgres 16; started by env `start` script |

### Postgres

- Prefer `bash scripts/cloud-postgres.sh start` (installs packages if missing, starts `16/main`, sets `postgres`/`postgres`, creates `thermal`). Raw equivalent: `sudo pg_ctlcluster 16 main start`.
- Postgres is NOT left running across boots — `start` brings it back up.
- Local role/DB used for dev: user `postgres` / password `postgres`, database `thermal`. The default `DATABASE_URL` in `.env.example` (`postgres://postgres:postgres@127.0.0.1:5432/thermal`) already matches this, so a copied `.env` works out of the box.
- Apply schema with `npm run db:migrate` (idempotent — already-applied migrations are skipped). The thermal cloud terminal runs this before the API; also run it whenever new files land in `db/migrations/`.
- `DATABASE_SSL` auto-enables for non-localhost hosts; keep it off (default) for the local `127.0.0.1` DB.

### `.env`

- Install / `scripts/setup-cursor.sh` copies `.env.example` → `.env` when missing. All external integrations (Stripe, YouTube/Google, AWS S3, Twitch, OpenAI) are gated behind env vars and default to dry-run (`CUTLINE_DRY_RUN=1`), so the app runs fully without any of those credentials — with reduced/no-op integration behavior.

### Non-obvious gotchas

- The API's `thermal-monitor` background job logs recurring `ffprobe ... No such file or directory` errors for demo VOD files under `inbox/` that do not exist. This is harmless noise — the API and all HTTP endpoints run fine regardless.
- Public `/feedback` submissions and AI-pipeline audience input persist to `inbox/audience_inputs.json` (a JSON file store), NOT to Postgres. Postgres backs the Thermal pipeline tables (`streamers`, `heat_spikes`, `clips`, `retainers`, `sales`, `bounty_posts`) and auth.
- The API degrades gracefully when Postgres is down (endpoints report `connected: false`), so a healthy `/api/health` alone does not prove the DB is up — check `/api/thermal/schema` for `connected: true` / `migrated: true`.

### Lint / test / build

Use the root `package.json` scripts: `npm run lint` (oxlint), `npm run typecheck` (tsc), `npm test` (node test runner), `npm run verify` (all three), `npm run build` (production build; not needed for dev). None of these require Postgres.

### View cloud env from the terminal

```bash
npm run env:view          # .cursor/environment.json + local probes
npm run env:view -- open  # dashboard Environments URL
```

Does **not** rebuild. Builds history lives in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments) (no public Builds API yet).
