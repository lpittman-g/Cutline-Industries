#!/usr/bin/env python3
"""Run several Artemis training configs at once across a GPU and CPU cores.

This is how to use a GPU and a CPU box together. Putting both in ONE
data-parallel job does not work: synchronous steps run at the pace of the slowest
rank, so a T4 paired with a 48-core CPU on an equal split lands at 0.19x the GPU
alone, the best possible speed-proportional split is 1.10x, and every step has to
all-reduce 612 MB of gradients - 25 to 245 s on a real network against 0.93 s of
T4 compute. A free Kaggle GPU has no inbound networking either.

Independent runs have none of that. Each device trains its own config at full
speed with zero synchronisation, and the ramp's search_space (engine.yaml) wants
several configs compared anyway, so the parallelism is free.

    # one GPU run + 2 CPU runs, learning rates from the search space
    python infra/singlegpu/run_parallel.py --corpus data/c.txt \\
        --license MIT --origin "my corpus" --out runs/sweep --steps 2000

    # CPU only, 3 concurrent configs
    python infra/singlegpu/run_parallel.py ... --cpu-workers 3 --no-gpu

Each run gets its own --out subdirectory, so checkpoints and metrics never collide
and any run can be resumed on its own. Cores are partitioned between workers and
pinned with OMP_NUM_THREADS, because oversubscribing threads makes every run slower.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GATEWAY = REPO / "gateway"
ENGINE = GATEWAY / "configs" / "engine.yaml"

CORES_FOR_GPU_HOST = 2   # the GPU run still needs cores to feed batches


def search_lrs() -> list[float]:
    """Learning rates from the ramp's search space, so a sweep matches the engine's."""
    try:
        import yaml
        space = yaml.safe_load(ENGINE.read_text())["search_space"]
        return [float(x) for x in space["lr"]]
    except Exception:
        return [1.5e-4, 3.0e-4, 6.0e-4]


def plan_workers(total_cores: int, cpu_workers: int, use_gpu: bool) -> tuple[int, list[int]]:
    """Split cores between the GPU host thread and N CPU workers.

    Returns (gpu_cores, [cores per CPU worker]). Oversubscription is the thing to
    avoid: N workers each spawning `total_cores` threads thrash and all run slower,
    so the cores are partitioned, never shared.
    """
    gpu_cores = min(CORES_FOR_GPU_HOST, total_cores) if use_gpu else 0
    left = max(0, total_cores - gpu_cores)
    if cpu_workers <= 0 or left == 0:
        return gpu_cores, []
    cpu_workers = min(cpu_workers, left)          # never more workers than cores
    base, extra = divmod(left, cpu_workers)
    return gpu_cores, [base + (1 if i < extra else 0) for i in range(cpu_workers)]


def build_command(*, device: str, threads: int, lr: float, args, out: Path) -> list[str]:
    cmd = [sys.executable, str(Path(__file__).parent / "run_single_gpu.py"),
           "--license", args.license, "--origin", args.origin,
           "--size", args.size, "--out", str(out),
           "--steps", str(args.steps), "--lr", f"{lr:g}",
           "--device", device, "--precision", args.precision]
    for c in args.corpus:
        cmd += ["--corpus", c]
    if device == "cpu":
        cmd += ["--threads", str(threads)]
    if args.stop_at:
        cmd += ["--stop-at", str(args.stop_at)]
    if args.autotune:
        cmd += ["--autotune"]
    return cmd


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", action="append", required=True)
    ap.add_argument("--license", required=True)
    ap.add_argument("--origin", required=True)
    ap.add_argument("--size", default="100m")
    ap.add_argument("--out", default="runs/sweep")
    ap.add_argument("--steps", type=int, default=2000)
    ap.add_argument("--stop-at", type=int, default=0)
    ap.add_argument("--cpu-workers", type=int, default=1,
                    help="concurrent CPU runs; cores are split between them")
    ap.add_argument("--no-gpu", action="store_true", help="do not use the GPU even if present")
    ap.add_argument("--precision", default="auto", choices=("auto", "bf16", "fp16", "fp32"))
    ap.add_argument("--autotune", action="store_true")
    ap.add_argument("--lr", type=float, action="append",
                    help="learning rate per run; defaults to engine.yaml search_space")
    ap.add_argument("--dry-run", action="store_true", help="print the plan, launch nothing")
    args = ap.parse_args(argv)

    sys.path.insert(0, str(GATEWAY))
    import torch

    use_gpu = torch.cuda.is_available() and not args.no_gpu
    cores = os.cpu_count() or 1
    gpu_cores, cpu_split = plan_workers(cores, args.cpu_workers, use_gpu)
    lrs = args.lr or search_lrs()

    jobs = []
    if use_gpu:
        jobs.append(("gpu", "cuda", gpu_cores, lrs[0]))
    for i, threads in enumerate(cpu_split):
        jobs.append((f"cpu{i}", "cpu", threads, lrs[(len(jobs)) % len(lrs)]))

    if not jobs:
        print("nothing to run: no GPU and --cpu-workers 0", file=sys.stderr)
        return 2

    print(f"host       : {cores} cores" + (f", GPU {torch.cuda.get_device_name(0)}" if use_gpu else ", no GPU"))
    print(f"stage      : {args.size}, {args.steps} steps")
    print(f"runs       : {len(jobs)}")
    for name, device, threads, lr in jobs:
        where = "GPU" if device == "cuda" else f"{threads} cores"
        print(f"  {name:<6} {where:<10} lr={lr:g}  -> {Path(args.out) / name}")
    if not use_gpu and not args.no_gpu:
        print("\nnote: no GPU visible, so these are CPU runs. A 48-core CPU is roughly 10x")
        print("      slower than one free T4 - see README.md before a long run.")

    if args.dry_run:
        return 0

    procs = []
    for name, device, threads, lr in jobs:
        out = Path(args.out) / name
        out.mkdir(parents=True, exist_ok=True)
        cmd = build_command(device=device, threads=threads, lr=lr, args=args, out=out)
        env = dict(os.environ)
        # Pin the maths libraries too: torch.set_num_threads alone does not stop
        # OpenMP/MKL from each spawning one thread per core in every worker.
        env["OMP_NUM_THREADS"] = str(max(1, threads))
        env["MKL_NUM_THREADS"] = str(max(1, threads))
        env["CUDA_VISIBLE_DEVICES"] = "0" if device == "cuda" else ""
        log = open(out / "launch.log", "w")
        procs.append((name, subprocess.Popen(cmd, env=env, stdout=log, stderr=subprocess.STDOUT), log, out))
        print(f"\nstarted {name} (pid {procs[-1][1].pid}) -> {out / 'launch.log'}", flush=True)

    t0 = time.time()
    failed = []
    for name, proc, log, out in procs:
        rc = proc.wait()
        log.close()
        status = "ok" if rc == 0 else f"FAILED rc={rc}"
        print(f"{name}: {status} after {time.time() - t0:.0f}s")
        if rc != 0:
            failed.append(name)
            tail = (out / "launch.log").read_text().strip().splitlines()[-5:]
            for line in tail:
                print(f"    {line}")

    print("\nresults:")
    for name, _, _, out in procs:
        metrics = out / "metrics.jsonl"
        if metrics.exists() and metrics.stat().st_size:
            last = json.loads(metrics.read_text().strip().splitlines()[-1])
            print(f"  {name:<6} step {last['step']:<6} loss {last.get('loss')}"
                  f"  val {last.get('val_loss', 'n/a')}")
        else:
            print(f"  {name:<6} no metrics written")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
