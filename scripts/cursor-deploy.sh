#!/usr/bin/env bash
# Cursor worker deploy script.
# Pushes to Gitea (triggers VPS auto-deploy via webhook) then
# calls deploy-agent /gen-zip to regenerate cutline-hub.zip.
set -euo pipefail

GITEA_REMOTE="${GITEA_REMOTE:-gitea}"
DEPLOY_AGENT_URL="${DEPLOY_AGENT_URL:-https://cutline-industries.studio/_internal/gen-zip}"
DEPLOY_SECRET="${DEPLOY_WEBHOOK_SECRET:-}"

echo "==> Pushing to Gitea (triggers VPS deploy)..."
git push origin main
git push "$GITEA_REMOTE" main 2>/dev/null || echo "  (gitea remote not configured — skipping; VPS deploy via origin mirror)"

echo "==> Waiting 30s for VPS deploy to settle..."
sleep 30

echo "==> Triggering hub ZIP regeneration..."
BODY="{}"
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$DEPLOY_SECRET" -hex | awk '{print $2}')"
HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST "$DEPLOY_AGENT_URL" \
  -H "Content-Type: application/json" \
  -H "x-deploy-signature: $SIG" \
  -d "$BODY" 2>/dev/null) || HTTP="000"

if [[ "$HTTP" == "202" ]]; then
  echo "==> ZIP generation triggered (202). Done."
else
  echo "  Warning: gen-zip returned HTTP $HTTP — run manually on VPS:"
  echo "  ssh user@<vps-ip> 'cd /srv/cutline-industries && bash scripts/gen-hub-zip.sh'"
fi
