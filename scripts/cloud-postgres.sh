#!/usr/bin/env bash
# Bootstrap system Postgres 16 for Cursor Cloud / local Thermal agents.
# Usage:
#   scripts/cloud-postgres.sh ensure   # install package if missing (install hook)
#   scripts/cloud-postgres.sh start    # start cluster + ensure thermal DB (start hook)
#                                     # also safe to call from the thermal terminal before migrate
set -euo pipefail

PG_MAJOR=16
PG_CLUSTER="${PG_MAJOR}/main"

have_pg16() {
  [[ -d "/etc/postgresql/${PG_MAJOR}/main" ]] \
    || [[ -x "/usr/lib/postgresql/${PG_MAJOR}/bin/postgres" ]]
}

ensure_packages() {
  if have_pg16 && command -v pg_ctlcluster >/dev/null 2>&1; then
    return 0
  fi
  echo "[cloud-postgres] Postgres ${PG_MAJOR} missing — installing versioned packages..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  # Pin major version: unversioned `postgresql` can resolve to != ${PG_MAJOR}.
  # On Ubuntu, contrib lives inside postgresql-${PG_MAJOR} (no separate -contrib-N deb).
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    "postgresql-${PG_MAJOR}" \
    "postgresql-client-${PG_MAJOR}"
}

start_cluster() {
  ensure_packages
  if sudo pg_ctlcluster "${PG_MAJOR}" main status >/dev/null 2>&1; then
    echo "[cloud-postgres] cluster ${PG_CLUSTER} already running"
  else
    echo "[cloud-postgres] starting cluster ${PG_CLUSTER}"
    sudo pg_ctlcluster "${PG_MAJOR}" main start
  fi

  # Wait until the server accepts connections (start hook may still be racing).
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if sudo -u postgres psql -Atc 'SELECT 1' >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  sudo -u postgres psql -Atc 'SELECT 1' >/dev/null

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
