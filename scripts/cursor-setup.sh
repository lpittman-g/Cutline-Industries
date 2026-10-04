#!/usr/bin/env bash
# Cursor Cloud environment bootstrap.
# Runs during the "install" phase — idempotent.
set -euo pipefail

echo "=== Cutline Cursor Setup ==="

# ── Node deps ──────────────────────────────────────────────
npm install

# ── .env ───────────────────────────────────────────────────
test -f .env || cp .env.example .env

# ── Postgres ───────────────────────────────────────────────
bash scripts/cloud-postgres.sh ensure

# ── Global CLIs ────────────────────────────────────────────
install_if_missing() {
  local bin="$1"; local pkg="$2"
  command -v "$bin" &>/dev/null || npm install -g "$pkg" --silent
}

install_if_missing ant        @anthropic-ai/cli
install_if_missing tsx        tsx
install_if_missing concurrently concurrently

# ── SSH key for VPS ────────────────────────────────────────
# Set VPS_SSH_KEY (base64-encoded private key) in Cursor Environment Secrets
# Cursor Dashboard → Environments → Secrets → VPS_SSH_KEY
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  echo "$VPS_SSH_KEY" | base64 -d > ~/.ssh/cutline_vps
  chmod 600 ~/.ssh/cutline_vps
  # Add to ssh config so `ssh vps` just works
  cat >> ~/.ssh/config <<'SSHCONF'
Host vps
  HostName cutline-industries.studio
  User ubuntu
  IdentityFile ~/.ssh/cutline_vps
  StrictHostKeyChecking no
SSHCONF
  echo "  SSH key loaded → use: ssh vps"
else
  echo "  Tip: set VPS_SSH_KEY secret in Cursor Dashboard to enable direct SSH"
fi

# ── ant auth (Anthropic CLI) ───────────────────────────────
if command -v ant &>/dev/null && [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  ant auth login --key "$ANTHROPIC_API_KEY" --profile admin 2>/dev/null || true
  echo "  ant auth configured for profile: admin"
fi

echo "=== Setup complete ==="
