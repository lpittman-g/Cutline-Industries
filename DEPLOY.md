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
| `gitea` | Self-hosted git + web UI + Packages + Actions | `git.cutline-industries.studio` · SSH `:2222` |
| `act-runner` | Gitea Actions CI/CD runner (≡ GitHub Actions runner) | Internal |
| `minio` | S3-compatible artifact + package storage (≡ GitHub artifact storage) | Internal `:9000` |
| `renovate` | Dependency update bot (≡ GitHub Dependabot) | Internal (cron) |
| `prometheus` | Metrics scraper (≡ GitHub Insights data) | Internal `:9090` |
| `grafana` | Analytics dashboard (≡ GitHub Insights UI) | `insights.cutline-industries.studio` |
| `deploy-agent` | Webhook listener → deploy runner | Internal only (Docker network) |
| `artemis-serve` | Artemis inference (GPT-2 → fine-tuned) | Internal `:8100` |
| `api` | Node/Express backend | Internal `:8787` |
| `web` | Nginx static frontend | Internal `:80` |
| `caddy` | TLS termination + reverse proxy | Public `:80/:443` |

## GitHub Service Equivalents

| GitHub Feature | Self-hosted Equivalent | URL |
|---|---|---|
| GitHub Actions | Gitea Actions + `act-runner` | Gitea → Repo → Actions |
| GitHub Packages | Gitea Packages (built-in) | `registry.cutline-industries.studio` |
| GitHub Pages | Gitea Pages (built-in) | `pages.cutline-industries.studio` |
| Dependabot | Renovate bot | Auto-PRs in Gitea |
| GitHub Insights | Prometheus + Grafana | `insights.cutline-industries.studio` |
| GitHub OAuth Apps | Gitea OAuth2 provider | `git.cutline-industries.studio/user/settings/applications` |
| Artifact Storage | Minio S3 | Internal (wired to Gitea + Actions) |

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

## Gitea Actions setup (after first deploy)

```bash
# 1. Open https://git.cutline-industries.studio/-/admin/runners
# 2. Click "Create new runner" — copy the token
# 3. Set GITEA_RUNNER_TOKEN in .env.production
# 4. Restart act-runner: docker compose restart act-runner
```

## Renovate setup (after first deploy)

```bash
# 1. Create a Gitea bot account: git.cutline-industries.studio/user/sign_up
#    (temporarily enable GITEA_DISABLE_REGISTRATION=false, then re-lock)
# 2. Generate an API token for the bot user → API token with repo scope
# 3. Set RENOVATE_GITEA_TOKEN in .env.production
# 4. Restart renovate: docker compose restart renovate
# 5. Renovate auto-discovers all repos under Cutline-Industries org
```

## Grafana setup (after first deploy)

```bash
# 1. Open https://insights.cutline-industries.studio
# 2. Login: admin / $GRAFANA_ADMIN_PASSWORD
# 3. Import dashboards:
#    - Gitea: https://grafana.com/grafana/dashboards/13092
#    - Node Exporter: https://grafana.com/grafana/dashboards/1860
```

## DNS records needed

| Record | Type | Value |
|---|---|---|
| `cutline-industries.studio` | A | `<VPS IP>` |
| `www.cutline-industries.studio` | A | `<VPS IP>` |
| `git.cutline-industries.studio` | A | `<VPS IP>` |
| `pages.cutline-industries.studio` | A | `<VPS IP>` |
| `insights.cutline-industries.studio` | A | `<VPS IP>` |
| `registry.cutline-industries.studio` | A | `<VPS IP>` |
