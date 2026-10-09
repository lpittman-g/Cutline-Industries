#!/usr/bin/env python3
"""Train an Artemis ramp stage on ONE GPU.

Built for the free tier (Kaggle T4/P100, Colab T4) but it runs on any single CUDA
device, including an A10 or A100 once GPU quota lands. It picks batch/accum from the
GPU's actual VRAM and lets artemis.train pick the precision (bf16 on Ampere+, fp16 +
GradScaler on Turing, which has no bf16).

    python infra/singlegpu/run_single_gpu.py --corpus data/corpus.txt --license MIT \
        --origin "my corpus" --out runs/100m --steps 2000

Resuming is automatic: point --out at the same directory and it continues from
latest.pt. On Kaggle, write --out under /kaggle/working so it survives the session.

Nothing here calls an external model or service. Corpora are local files, and every
source needs --license and --origin recorded, same as the main data path.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GATEWAY = REPO / "gateway"
sys.path.insert(0, str(GATEWAY))

# (VRAM ceiling GB, micro-batch, accum) for the 100m config at seq 2048, smallest card
# first. Every row multiplies to 32 sequences = 65,536 tokens/step, so the optimizer sees
# the same batch on every card and only the micro-batch changes to fit.
#
# The ceilings are the cards' REPORTED VRAM, which runs a little under the marketing
# number (a 16GB T4 reports ~15.8), so each ceiling sits just above the card it is for.
# Sizing is driven by the largest allocation in the step: the fp32 logits copy that
# cross_entropy makes, batch x 2048 x 32000 x 4 bytes - 1.0 GB per sequence of batch,
# on top of ~2.5 GB of fp32 weights, grads and AdamW moments.
BATCH_PLAN = [
    (12.0, 2, 16),   # older/smaller cards, and Colab's occasional 11GB K80-class slice
    (17.0, 4, 8),    # T4 16GB, P100 16GB  <- the free tier
    (25.0, 8, 4),    # A10 24GB, L4 24GB
    (50.0, 16, 2),   # A100 40GB
]
LARGEST = (32, 1)    # A100 80GB, H100 80GB


def plan_for(vram_gb: float) -> tuple[int, int]:
    """Pick (micro_batch, accum) for a card of this size. Every result is 32 sequences."""
    for ceiling, batch, accum in BATCH_PLAN:
        if vram_gb <= ceiling:
            return batch, accum
    return LARGEST


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", action="append", required=True,
                    help="local text file to train on; repeat for several")
    ap.add_argument("--license", required=True, help="license of the corpus, recorded in the manifest")
    ap.add_argument("--origin", required=True, help="where the corpus came from, recorded in the manifest")
    ap.add_argument("--domain", help="optional expert-domain label for these files")
    ap.add_argument("--size", default="100m", help="ramp stage from gateway/configs/models.yaml")
    ap.add_argument("--out", default="runs/100m")
    ap.add_argument("--steps", type=int, default=2000)
    ap.add_argument("--stop-at", type=int, default=0,
                    help="stop early (Kaggle cuts sessions at 9h/12h); resume with the same --steps")
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--vocab", type=int, default=32000)
    ap.add_argument("--batch", type=int, default=0, help="override the VRAM-derived micro-batch")
    ap.add_argument("--accum", type=int, default=0, help="override the VRAM-derived accumulation")
    ap.add_argument("--precision", default="auto", choices=("auto", "bf16", "fp16", "fp32"))
    args = ap.parse_args(argv)

    import torch
    from artemis.data import prepare
    from artemis.tokenizer import train_tokenizer
    from artemis.train import main as train_main

    corpora = [Path(c) for c in args.corpus]
    missing = [str(c) for c in corpora if not c.is_file()]
    if missing:
        print(f"corpus file(s) not found: {', '.join(missing)}", file=sys.stderr)
        return 2

    if not torch.cuda.is_available():
        print("No CUDA device. This script is for a single GPU; on CPU use --size proto instead:\n"
              "  python -m artemis.train --size proto --data <dir> --out <dir>", file=sys.stderr)
        return 2

    name = torch.cuda.get_device_name(0)
    vram = torch.cuda.get_device_properties(0).total_memory / 1e9
    batch, accum = plan_for(vram)
    batch = args.batch or batch
    accum = args.accum or accum

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    work = out / "prep"
    work.mkdir(exist_ok=True)
    tok = work / "tokenizer.json"
    data = work / "data"

    print(f"GPU        : {name} ({vram:.1f} GB)")
    print(f"stage      : {args.size}")
    print(f"batch plan : micro {batch} x accum {accum}")
    print(f"corpus     : {', '.join(str(c) for c in corpora)}")

    # Tokenizer and shards are reused across resumes; rebuilding them would reshuffle
    # the data and invalidate the checkpoint's step accounting.
    if not tok.exists():
        print("training tokenizer ...", flush=True)
        train_tokenizer([str(c) for c in corpora], args.vocab, tok)
    else:
        print(f"tokenizer  : reusing {tok}")

    if not (data / "manifest.json").exists():
        print("tokenizing corpus into shards ...", flush=True)
        sources = [{"path": str(c), "license": args.license, "origin": args.origin,
                    **({"domain": args.domain} if args.domain else {})} for c in corpora]
        manifest = prepare(sources, str(tok), str(data))
        print(f"  train tokens {manifest['train_tokens']:,}  val tokens {manifest['val_tokens']:,}")
    else:
        manifest = json.loads((data / "manifest.json").read_text())
        print(f"shards     : reusing {data} ({manifest['train_tokens']:,} train tokens)")

    argv_train = ["--size", args.size, "--data", str(data), "--out", str(out),
                  "--steps", str(args.steps), "--batch", str(batch), "--accum", str(accum),
                  "--lr", str(args.lr), "--precision", args.precision]
    if args.stop_at:
        argv_train += ["--stop-at", str(args.stop_at)]
    print("starting training\n", flush=True)
    result = train_main(argv_train)
    print("\nlast metrics:", json.dumps(result))
    print(f"checkpoint: {out / 'latest.pt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
