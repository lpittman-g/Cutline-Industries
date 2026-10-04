#!/usr/bin/env bash
# Generate cutline-hub.zip from the live artifact data files.
# Run on the VPS after docker compose up, or call via deploy-agent.
# Output: public/downloads/cutline-hub.zip
set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/cutline-industries}"
HUB_DATA="${REPO_DIR}/hub-data"          # populated by extract_all_repos.py
HUB_PAGE="${REPO_DIR}/dist/index.html"   # built frontend
OUT_DIR="${REPO_DIR}/public/downloads"
OUT="${OUT_DIR}/cutline-hub.zip"

mkdir -p "$OUT_DIR"

if [ ! -d "$HUB_DATA" ]; then
  echo "hub-data not found at $HUB_DATA — run scripts/extract_all_repos.py first" >&2
  exit 1
fi

# Build the zip using Python (always available in the Python container)
python3 - "$HUB_DATA" "$HUB_PAGE" "$OUT" <<'PYEOF'
import sys, zipfile, os

data_dir, page, out = sys.argv[1], sys.argv[2], sys.argv[3]

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    if os.path.exists(page):
        z.write(page, "index.html")
    for f in sorted(os.listdir(data_dir)):
        z.write(f"{data_dir}/{f}", f"data/{f}")
    z.writestr("README.txt",
        "Cutline Hub — offline snapshot\n"
        "Open index.html in any browser. All repo data is in data/.\n"
        "No server needed.\n")

size = os.path.getsize(out)
print(f"Generated {out}: {size // 1024} KB")
PYEOF
