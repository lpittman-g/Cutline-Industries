#!/usr/bin/env bash
# One-time Cursor setup for Cutline Industries (no Copilot required)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CURSOR_MCP="${HOME}/.cursor/mcp.json"
EXAMPLE="${ROOT}/.cursor/mcp.json.example"

echo "Cutline → Cursor primary setup"
cd "$ROOT"
npm install

for tool in phone-approval-lite voice-print; do
  if [[ -d "tools/${tool}" ]]; then
    echo "Installing tools/${tool}..."
    (cd "tools/${tool}" && npm install)
  fi
done

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [[ -f "$EXAMPLE" ]]; then
  if [[ -f "$CURSOR_MCP" ]]; then
    echo "Keeping existing ~/.cursor/mcp.json (merge voice-print manually from .cursor/mcp.json.example)"
  else
    mkdir -p "$(dirname "$CURSOR_MCP")"
    cp "$EXAMPLE" "$CURSOR_MCP"
    echo "Wrote ~/.cursor/mcp.json"
  fi
fi

echo ""
echo "Done. Open this folder in Cursor desktop."
echo "Docs: docs/CURSOR-PRIMARY.md"
