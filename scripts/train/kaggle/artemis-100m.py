"""Train Artemis 100m on Kaggle's free T4s. Designed to be interrupted.

Kaggle gives two T4s and roughly 30 GPU-hours a week, with a session limit
well under the ~10.5 hours this run needs on both cards. That is survivable
only because artemis.train resumes exactly -- step, RNG state and the fp16
loss scale all ride in the checkpoint -- so the run is deliberately built as
"do as much as the session allows, then stop cleanly".

HOW A SECOND SESSION CONTINUES: everything lands in /kaggle/working, which
Kaggle keeps as the notebook's output. Attach the previous version's output as
a dataset input and this script finds the checkpoint and the prepared corpus
under /kaggle/input and carries on instead of starting over.

T4 IS TURING, SO fp16 NOT bf16. The trainer already picks this and attaches a
GradScaler; nothing here needs to force it. That path exists in the codebase
precisely because free Kaggle GPUs and the one affordable Azure GPU are both
pre-Ampere.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO = "https://github.com/lpittman-g/Cutline-Industries.git"
WORK = Path("/kaggle/working/artemis")
SRC = Path("/kaggle/working/source")
SHARDS = int(os.environ.get("ARTEMIS_SHARDS", "31"))     # ~2.2B tokens
SIZE = os.environ.get("ARTEMIS_SIZE", "100m")
# Stop before Kaggle kills the session, so the final checkpoint is written by
# us rather than lost to SIGKILL. Kaggle's ceiling is ~12h; leave a margin for
# the commit to flush /kaggle/working.
BUDGET_S = float(os.environ.get("ARTEMIS_BUDGET_S", str(10.5 * 3600)))


def run(cmd, **kw):
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, check=True, **kw)


def patch_bf16_detection(gateway: Path) -> None:
    """Stop the trainer selecting bf16 on a card that has no bf16.

    train.py picks the autocast dtype with torch.cuda.is_bf16_supported(), and
    on a Tesla T4 that returns TRUE -- it reports whether CUDA can emulate
    bf16, not whether the silicon implements it. The first run on Kaggle
    printed "autocast bfloat16 on Tesla T4" and trained in emulated bf16 with
    no GradScaler, which is precisely the case the surrounding comment was
    written to prevent.

    Compute capability is the honest test: bf16 arrives with Ampere, sm_80.
    Turing (T4, sm_75) and Pascal (P100, sm_60) fall through to fp16, which is
    what they actually have, and the GradScaler attaches as intended.

    Applied here rather than in the repository only because this session cannot
    push. Fix it upstream and delete this function.
    """
    f = gateway / "artemis" / "train.py"
    src = f.read_text()
    old = "torch.cuda.is_bf16_supported()"
    new = "torch.cuda.get_device_capability()[0] >= 8"
    if old not in src:
        print("  bf16 patch: pattern absent -- already fixed upstream?", flush=True)
        return
    f.write_text(src.replace(old, new))
    print(f"  bf16 patch: {old} -> {new}", flush=True)


def find_prior():
    """A previous session's output, attached as an input.

    Looks for the CORPUS, not the checkpoint. The first run OOMed at step 1
    after spending ~3 h preparing 2.24B tokens, so a prior with usable data and
    no checkpoint is the normal case, not an edge case -- and re-preparing
    would burn another 3 h of a 30 h weekly allowance for nothing.
    """
    root = Path("/kaggle/input")
    if not root.exists():
        return None
    for d in sorted(root.iterdir()):
        if (d / "artemis" / "data" / "train.bin").exists():
            return d / "artemis"
    return None


def main():
    t0 = time.time()
    WORK.mkdir(parents=True, exist_ok=True)

    print("=== GPUs ===", flush=True)
    subprocess.run(["nvidia-smi", "--query-gpu=index,name,memory.total",
                    "--format=csv,noheader"], check=False)

    run([sys.executable, "-m", "pip", "install", "-q",
         "tokenizers", "huggingface_hub", "pyarrow", "pyyaml"])

    if not SRC.exists():
        run(["git", "clone", "--quiet", REPO, str(SRC)])
    else:
        run(["git", "-C", str(SRC), "pull", "--ff-only", "--quiet"])
    gateway = SRC / "gateway"
    patch_bf16_detection(gateway)

    prior = find_prior()
    data_dir = WORK / "data"
    if prior:
        # /kaggle/input is read-only, which is fine: TokenStream memory-maps the
        # bins read-only. Copying 4.4 GB into /kaggle/working would waste both
        # the time and the 20 GB output allowance.
        data_dir = prior / "data"
        print(f"=== reusing prepared corpus at {data_dir} ===", flush=True)
        (WORK / "run").mkdir(parents=True, exist_ok=True)
        ck = prior / "run" / "latest.pt"
        if ck.exists() and not (WORK / "run" / "latest.pt").exists():
            run(["cp", str(ck), str(WORK / "run" / "latest.pt")])
            print("=== resuming from checkpoint ===", flush=True)

    if not (data_dir / "train.bin").exists():
        print("=== preparing corpus (one shard at a time; deleted as it goes) ===", flush=True)
        run([sys.executable, "-m", "artemis.stream_corpus",
             "--work", str(WORK), "--shards", str(SHARDS), "--vocab", "32000",
             "--tokenizer-shards", "2"], cwd=gateway)

    manifest = json.loads((data_dir / "manifest.json").read_text())
    tokens = manifest["train_tokens"] + manifest["val_tokens"]
    print(f"=== corpus: {tokens:,} tokens ===", flush=True)

    # Steps follow the token budget, not the clock. The session may not reach
    # the end; --stop-at lets it stop cleanly where it is, and the next session
    # picks up from the same step count.
    # MEASURED, not assumed: batch 6 x seq 2048 OOMs on a T4 -- it asked for
    # 1.12 GiB with 490 MiB free of 14.56 GiB. docs/TRAIN-ON-YOUR-OWN-GPU.md
    # claims that shape "fits comfortably in 12 GB"; it does not, and that
    # claim cost one run. batch 2 with accum 12 holds tokens-per-step
    # identical, so the schedule is unchanged, at a third of the activations.
    batch, accum, seq = 2, 12, 2048
    ngpu = int(subprocess.run(["nvidia-smi", "--list-gpus"], capture_output=True,
                              text=True).stdout.count("GPU "))
    per_step = batch * accum * seq * max(ngpu, 1)
    steps = 2_215_111_680 // per_step
    print(f"=== {ngpu} GPU(s), {per_step:,} tokens/step, {steps:,} steps total ===", flush=True)

    args = ["--size", SIZE, "--data", str(data_dir), "--out", str(WORK / "run"),
            "--steps", str(steps), "--batch", str(batch), "--accum", str(accum),
            "--lr", "3e-4", "--warmup", str(max(1, steps // 50)), "--seed", "1337",
            "--route-coef", "0", "--eval-every", "500", "--eval-batches", "20",
            "--ckpt-every", "250"]            # frequent: a lost session costs 250 steps

    remaining = BUDGET_S - (time.time() - t0)
    print(f"=== training, {remaining/3600:.1f} h of session budget left ===", flush=True)
    cmd = ([sys.executable, "-m", "torch.distributed.run", "--nproc_per_node", str(ngpu),
            "-m", "artemis.train"] if ngpu > 1 else [sys.executable, "-m", "artemis.train"])
    try:
        subprocess.run(cmd + args, cwd=gateway, check=True, timeout=max(60, remaining))
        print("=== RUN COMPLETE ===", flush=True)
    except subprocess.TimeoutExpired:
        print("=== session budget reached; checkpoint is current, resume next session ===",
              flush=True)

    m = WORK / "run" / "metrics.jsonl"
    if m.exists():
        last = [l for l in m.read_text().splitlines() if l.strip()][-1]
        print("last metrics:", last, flush=True)
    subprocess.run(["du", "-sh", str(WORK)], check=False)


if __name__ == "__main__":
    main()
