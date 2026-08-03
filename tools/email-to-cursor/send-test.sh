#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
URL=$(cat "$ROOT/secrets/cursor-webhook-url.txt")
KEY=$(cat "$ROOT/secrets/cursor-webhook-key.txt")
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"lamont@phone","subject":"TEST from agent","date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","body":"Test: email bridge is wired."}'
echo
