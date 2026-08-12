#!/usr/bin/env bash
# Bootstrap system Postgres 16 for Cursor Cloud / local Thermal agents.
# Usage:
#   scripts/cloud-postgres.sh ensure   # install package if missing (install hook)
#   scripts/cloud-postgres.sh start    # start cluster + ensure thermal DB (start hook)
set -euo pipefail

ensure_packages() {
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    return 0
  fi
  echo "[cloud-postgres] pg_ctlcluster missing — installing postgresql..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
}

start_cluster() {
  ensure_packages
  if sudo pg_ctlcluster 16 main status >/dev/null 2>&1; then
    echo "[cloud-postgres] cluster 16/main already running"
  else
    echo "[cloud-postgres] starting cluster 16/main"
    sudo pg_ctlcluster 16 main start
  fi

  # Match .env.example: postgres://postgres:postgres@127.0.0.1:5432/thermal
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD 'postgres';" >/dev/null
  if ! sudo -u postgres psql -Atc "SELECT 1 FROM pg_database WHERE datname='thermal'" | grep -q 1; then
    echo "[cloud-postgres] creating database thermal"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE thermal;"
  fi
}

cmd="${1:-start}"
case "$cmd" in
  ensure) ensure_packages ;;
  start) start_cluster ;;
  *)
    echo "Usage: $0 {ensure|start}" >&2
    exit 1
    ;;
esac
