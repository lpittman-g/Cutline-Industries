# Cutline Deployment

All deployments go through the **self-hosted Gitea** instance — no GitHub Actions, no external CI.

## Architecture

```
git push gitea main
   └─► Gitea (git.cutline-industries.studio)
         └─► webhook → deploy-agent:9000/deploy
               └─► git pull + docker compose up --build
```

## Services (docker-compose)

| Service | Role | Exposure |
|---|---|---|
| `gitea` | Self-hosted git + web UI | `git.cutline-industries.studio` (Caddy) · SSH `:2222` |
| `deploy-agent` | Webhook listener → deploy runner | Internal only (Docker network) |
| `artemis-serve` | Artemis inference (GPT-2 → fine-tuned) | Internal `:8100` |
| `api` | Node/Express backend | Internal `:8787` |
| `web` | Nginx static frontend | Internal `:80` |
| `caddy` | TLS termination + reverse proxy | Public `:80/:443` |

## First-time VPS setup

```bash
# 1. Clone the repo to the VPS deploy path
git clone https://github.com/lpittman-g/Cutline-Industries /srv/cutline-industries
cd /srv/cutline-industries

# 2. Set env vars
cp .env.example .env.production
# Edit .env.production with real secrets

# 3. Add DEPLOY_WEBHOOK_SECRET to .env.production
echo "DEPLOY_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env.production

# 4. Bring the stack up (first boot downloads GPT-2 ~500 MB)
docker compose up -d --build

# 5. Apply DB migrations
docker compose exec api node --import tsx/esm db/migrate.ts
```

## Gitea setup (one-time)

```bash
# 1. Open https://git.cutline-industries.studio
# 2. Complete the install wizard (admin account, org name: Cutline-Industries)
# 3. Mirror the GitHub repo:
#    New repo → Migration → GitHub → lpittman-g/Cutline-Industries
#    Check "This repository will be a mirror" → Migrate

# 4. Add deploy webhook in Gitea:
#    Repo → Settings → Webhooks → Add Webhook → Gitea
#    URL: http://deploy-agent:9000/deploy
#    Secret: (value of DEPLOY_WEBHOOK_SECRET)
#    Events: Push events only

# 5. Add the Gitea remote locally:
git remote add gitea ssh://git@git.cutline-industries.studio:2222/Cutline-Industries/Cutline-Industries.git
```

## Day-to-day deploy

```bash
# Push to Gitea → webhook triggers automatic deploy
git push gitea main

# Or push to both
git push origin main && git push gitea main
```

## Manual deploy (fallback)

```bash
ssh user@<vps-ip>
cd /srv/cutline-industries
git pull origin main   # or: git pull gitea main
docker compose up -d --build --remove-orphans
docker compose exec api node --import tsx/esm db/migrate.ts
```

## DNS records needed

| Record | Type | Value |
|---|---|---|
| `cutline-industries.studio` | A | `<VPS IP>` |
| `www.cutline-industries.studio` | A | `<VPS IP>` |
| `git.cutline-industries.studio` | A | `<VPS IP>` |
