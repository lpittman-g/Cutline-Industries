#!/bin/bash
# On-node launcher for an Artemis pretraining run on one 8xH100 node.
# Bridges the lake's per-dataset token shards to train.py's expected train.bin/val.bin:
# raw token shards share one dtype, so concatenating them is a valid token stream.
# Stages a token-budget subset onto local NVMe (ND96isr has ~28 TB), holds the last
# shard out as validation, then launches torchrun across all 8 GPUs.
set -euo pipefail

SHARDS="" OUT="" SIZE="100m" BUDGET=20000000000   # 20B tokens default (~40 GB at uint16)
while [ $# -gt 0 ]; do
  case "$1" in
    --shards) SHARDS=$2; shift 2;;
    --out) OUT=$2; shift 2;;
    --size) SIZE=$2; shift 2;;
    --token-budget) BUDGET=$2; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done
[ -n "$SHARDS" ] && [ -n "$OUT" ] || { echo "usage: launch.sh --shards DIR --out DIR [--size S] [--token-budget N]" >&2; exit 2; }

export PYTHONPATH="$(pwd)/gateway:${PYTHONPATH:-}"
WORK="${AZ_BATCHAI_JOB_TEMP_DIR:-/mnt/artemis}"; mkdir -p "$WORK"

python - "$SHARDS" "$WORK" "$BUDGET" <<'PY'
import glob, json, os, shutil, sys
shards_dir, work, budget = sys.argv[1], sys.argv[2], int(sys.argv[3])
man = json.load(open(os.path.join(shards_dir, "manifest.json")))
dtype = man["dtype"]; nbytes = 4 if dtype == "uint32" else 2
shards = sorted(glob.glob(os.path.join(shards_dir, "shard_*.bin")))
assert len(shards) >= 2, f"need >=2 shards in {shards_dir}, found {len(shards)}"
val, train = shards[-1], shards[:-1]
budget_bytes, written = budget * nbytes, 0
with open(os.path.join(work, "train.bin"), "wb") as out:
    for s in train:
        if written >= budget_bytes:
            break
        with open(s, "rb") as f:
            shutil.copyfileobj(f, out, 1 << 24)
        written += os.path.getsize(s)
shutil.copyfile(val, os.path.join(work, "val.bin"))
json.dump({"dtype": dtype}, open(os.path.join(work, "manifest.json"), "w"))
print(f"staged {written/1e9:.1f} GB train ({dtype}) from {len(train)} shards; val={os.path.basename(val)}", flush=True)
PY

exec torchrun --nproc_per_node 8 -m artemis.train \
  --size "$SIZE" --data "$WORK" --out "$OUT" \
  --steps 50000 --batch 8 --accum 4 --lr 3e-4 --warmup 2000 \
  --eval-every 500 --eval-batches 20 --ckpt-every 1000
