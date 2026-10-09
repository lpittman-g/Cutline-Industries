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
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GATEWAY = REPO / "gateway"
sys.path.insert(0, str(GATEWAY))

EFFECTIVE_SEQUENCES = 32   # sequences per optimizer step, held constant across hardware

# (VRAM ceiling GB, micro-batch) for the 100m config at seq 2048, smallest card first.
# The micro-batch is the LARGEST that fits; accum is whatever keeps the effective batch
# at EFFECTIVE_SEQUENCES. Bigger micro-batches are modestly faster (fewer, larger
# matmuls) until they do not fit, at which point they fail outright - so these are sized
# to the memory, and --autotune probes the real device when you want the true maximum.
#
# Ceilings are REPORTED VRAM, which runs under the marketing number (a 16GB T4 reports
# ~15.8), so each ceiling sits just above the card it is for.
#
# Per-sequence cost at seq 2048 / vocab 32000, roughly 1.0 GB:
#   fp16 logits        2048 x 32000 x 2  = 131 MB
#   fp32 logits copy   cross_entropy()   = 262 MB
#   cross_entropy work                   ~ 262 MB
#   activations, 12 layers               ~  94 MB
# on top of ~2.5 GB of fp32 weights, gradients and AdamW moments, which is fixed.
BATCH_PLAN = [
    (12.0, 2),    # ~11GB slices (older Colab)
    (17.0, 8),    # T4 16GB, P100 16GB  <- the free tier
    (25.0, 16),   # A10 24GB, L4 24GB
]
LARGEST = EFFECTIVE_SEQUENCES   # A100/H100: the whole step fits in one micro-batch

# CPU is compute-bound, not memory-bound. Measured on this repo's 100m config, going from
# micro-batch 1 to 2 bought ~20% (212 -> 254 tok/s) and the curve flattens, while step
# latency grows linearly - so a large micro-batch only delays the first checkpoint.
CPU_MICRO_BATCH = 4


def divisors(n: int) -> list[int]:
    return [d for d in range(1, n + 1) if n % d == 0]


def plan_for(vram_gb: float) -> tuple[int, int]:
    """Pick (micro_batch, accum) for a card of this size, holding the effective batch."""
    micro = LARGEST
    for ceiling, batch in BATCH_PLAN:
        if vram_gb <= ceiling:
            micro = batch
            break
    micro = min(micro, EFFECTIVE_SEQUENCES)
    return micro, EFFECTIVE_SEQUENCES // micro


def autotune_micro_batch(size: str, device, amp_dtype, start: int, log=print) -> int:
    """Find the largest micro-batch that actually completes a step on THIS device.

    Probes downward through divisors of EFFECTIVE_SEQUENCES so micro x accum stays exact.
    Arithmetic predicts memory badly (allocator fragmentation, cuDNN workspaces, kernel
    scratch), so this measures instead. Falls back to 1, which always fits.
    """
    import torch
    from artemis.model import ArtemisLM
    from artemis.train import model_config

    cfg = model_config(size)
    candidates = sorted((d for d in divisors(EFFECTIVE_SEQUENCES) if d <= start), reverse=True)
    for micro in candidates:
        model = opt = None
        try:
            model = ArtemisLM(cfg).to(device)
            opt = torch.optim.AdamW(model.parameters(), lr=1e-9)
            x = torch.randint(0, cfg.vocab_size, (micro, cfg.max_seq_len), device=device)
            d = torch.full((micro, cfg.max_seq_len), -1, device=device)
            with torch.autocast(device.type, dtype=amp_dtype or torch.float32,
                                enabled=amp_dtype is not None):
                _, loss = model(x, x, d if cfg.moe_layers else None)
            loss.backward()
            opt.step()            # AdamW allocates its moments here, so include it
            log(f"  autotune: micro-batch {micro} fits")
            return micro
        except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
            if "out of memory" not in str(exc).lower():
                raise
            log(f"  autotune: micro-batch {micro} does not fit")
        finally:
            del model, opt
            if device.type == "cuda":
                torch.cuda.empty_cache()
                torch.cuda.reset_peak_memory_stats()
    return 1


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
    ap.add_argument("--vocab", type=int, default=0,
                    help="tokenizer vocabulary size; defaults to the --size config's "
                         "vocab_size, which it must match")
    ap.add_argument("--batch", type=int, default=0, help="override the VRAM-derived micro-batch")
    ap.add_argument("--accum", type=int, default=0, help="override the VRAM-derived accumulation")
    ap.add_argument("--precision", default="auto", choices=("auto", "bf16", "fp16", "fp32"))
    ap.add_argument("--device", default="auto", choices=("auto", "cuda", "cpu"),
                    help="auto uses the GPU when there is one. cpu trains on cores only: "
                         "viable but roughly 10x slower than a single T4 (see README)")
    ap.add_argument("--threads", type=int, default=0,
                    help="CPU worker threads; defaults to every core")
    ap.add_argument("--autotune", action="store_true",
                    help="probe the device for the largest micro-batch that actually fits, "
                         "instead of using the table")
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

    use_cuda = torch.cuda.is_available() if args.device == "auto" else args.device == "cuda"
    if use_cuda and not torch.cuda.is_available():
        print("--device cuda but no CUDA device is visible", file=sys.stderr)
        return 2

    if use_cuda:
        device = torch.device("cuda", 0)
        name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        batch, accum = plan_for(vram)
    else:
        device = torch.device("cpu")
        threads = args.threads or os.cpu_count() or 1
        torch.set_num_threads(threads)
        name = f"cpu x{threads}"
        vram = 0.0
        batch, accum = CPU_MICRO_BATCH, EFFECTIVE_SEQUENCES // CPU_MICRO_BATCH
        print(f"CPU training on {threads} threads. This is compute-bound: expect roughly "
              f"10x a single T4.\n  See infra/singlegpu/README.md for measured rates before "
              f"committing to a long run.", file=sys.stderr)

    if args.autotune:
        from artemis.train import resolve_precision
        amp_dtype, _, _ = resolve_precision(device, args.precision)
        batch = autotune_micro_batch(args.size, device, amp_dtype, start=batch)
        accum = EFFECTIVE_SEQUENCES // batch

    batch = args.batch or batch
    accum = args.accum or accum

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    work = out / "prep"
    work.mkdir(exist_ok=True)
    tok = work / "tokenizer.json"
    data = work / "data"

    # The tokenizer's vocabulary MUST equal the model config's vocab_size. A larger
    # tokenizer emits ids past the end of the embedding table and training dies with
    # "IndexError: index out of range in self" on the first batch, which does not name
    # the real cause. Default it from the config rather than making the caller match it.
    from artemis.train import model_config
    want_vocab = model_config(args.size).vocab_size
    vocab = args.vocab or want_vocab
    if vocab != want_vocab:
        print(f"--vocab {vocab} does not match the '{args.size}' config's vocab_size "
              f"({want_vocab}); the embedding table would be indexed out of range",
              file=sys.stderr)
        return 2

    print(f"device     : {name}" + (f" ({vram:.1f} GB)" if vram else ""))
    print(f"stage      : {args.size} (vocab {vocab})")
    print(f"batch plan : micro {batch} x accum {accum}")
    print(f"corpus     : {', '.join(str(c) for c in corpora)}")

    # Tokenizer and shards are reused across resumes; rebuilding them would reshuffle
    # the data and invalidate the checkpoint's step accounting.
    if not tok.exists():
        print("training tokenizer ...", flush=True)
        train_tokenizer([str(c) for c in corpora], vocab, tok)
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
