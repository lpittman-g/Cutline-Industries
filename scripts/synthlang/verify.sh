#!/usr/bin/env bash
# Runs the SynthLang verification loop defined in synthlang/autopilot.json.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "→ lint (with --fix)"
npm run lint -- --fix

echo "→ typecheck"
npm run typecheck

echo "→ unit tests"
npm test

echo "✓ SynthLang verification loop passed"
