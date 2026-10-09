# Single-GPU Artemis training

Trains a ramp stage on **one** GPU. Built so stage 1 can run on a free Kaggle or Colab
T4 while Azure GPU quota is still pending, and so the same command works unchanged on an
A10, A100 or H100 once quota lands.

## Why this exists

Every GPU family quota on all Cutline Azure subscriptions is currently **0** — T4, A10,
A100 and H100 alike (checked 2026-10-09; self-service quota requests for GPU families are
auto-rejected, and the two open tickets from Oct 5 are awaiting human review). Generic
vCPU quota raises *do* go through, but they do not help: no GPU family has a non-zero
limit to spend them on.

Stage 1 of the ramp does not need a cluster. The `100m` config is **153M parameters /
111M active**, which fits comfortably on a single 16GB card. The H100 node is what
stages 3 and 4 need.

## Run it

```bash
python infra/singlegpu/run_single_gpu.py \
  --corpus data/my_corpus.txt \
  --license MIT \
  --origin "where this text came from" \
  --out runs/100m \
  --steps 2000
```

`--license` and `--origin` are required, not decorative: `artemis.data.prepare` refuses a
source without a recorded license, and both land in the shard manifest. Pass `--corpus`
more than once for several files. Add `--domain <expert>` to label a corpus for one of the
ten experts.

Resuming is automatic — point `--out` at the same directory and it picks up from
`latest.pt`. The tokenizer and token shards under `<out>/prep/` are reused rather than
rebuilt, because rebuilding them would reshuffle the data and invalidate the
checkpoint's step accounting.

### On Kaggle

Sessions are cut at 9h (and the weekly GPU budget is 30h), so cap each run and resume:

```bash
--out /kaggle/working/runs/100m --steps 2000 --stop-at 500
```

`--steps` sets the learning-rate schedule and must stay the same across resumes;
`--stop-at` is where this session stops. Write under `/kaggle/working` so the checkpoint
survives, and download `latest.pt` before the session ends.

## Precision is chosen for the card

| GPU | bf16? | What it uses |
|---|---|---|
| T4, P100 (Turing/Pascal) | no | **fp16 + GradScaler** |
| A10, L4, A100, H100 (Ampere+) | yes | **bf16**, no scaler |
| CPU | — | fp32 |

Turing has no bf16, so a bf16 autocast fails there. fp16 alone is worse than failing: its
gradients underflow to zero and the run quietly learns nothing, which is why the fp16 path
carries a `GradScaler`. Override with `--precision {auto,bf16,fp16,fp32}`; forcing fp16 on
an A100 is legal and useful for reproducing a T4 run.

Two ordering details in `artemis/train.py` matter and are covered by
`gateway/tests/test_precision.py`:

- `scaler.unscale_(opt)` runs **before** `clip_grad_norm_` and before `grad_norms`. Both
  read `.grad` directly, which is still multiplied by the scale factor until that call.
  Clipping a scaled norm against `max_norm=1.0` would shrink every gradient by ~65,536×.
- An fp16 overflow makes `clip_grad_norm_` return `inf`, which `json.dumps` writes as
  invalid JSON. `metrics.jsonl` records `null` and flags `scaler_skipped_step`. A few
  skipped steps early in a run are normal; steps that never stop being skipped are not.

The scaler's state is saved in the checkpoint, so a resumed run keeps its scale instead
of re-converging on one.

## Batch sizing

The micro-batch is derived from the card's reported VRAM, but every card trains on the
**same effective batch** — 32 sequences × 2048 tokens = 65,536 tokens/step — so results
are comparable across hardware and only the accumulation count changes.

| Card | Reported VRAM | micro-batch × accum |
|---|---|---|
| ~11GB slice | 11.4 | 2 × 16 |
| T4 / P100 | 15.8 / 16.3 | 4 × 8 |
| A10 / L4 | 23.0 / 22.5 | 8 × 4 |
| A100 40GB | 39.6 | 16 × 2 |
| A100 / H100 80GB | 79.2 | 32 × 1 |

Sizing follows the step's largest allocation — the fp32 logits copy `cross_entropy`
makes, `batch × 2048 × 32000 × 4` bytes, about 1.0 GB per sequence — on top of ~2.5 GB of
fp32 weights, gradients and AdamW moments. Override with `--batch` / `--accum`.

Ceilings are **reported** VRAM, which runs under the marketing number (a 16GB T4 reports
~15.8), so each ceiling sits just above its card. An earlier version got this wrong and a
T4 fell through to the A10's larger micro-batch; `gateway/tests/test_single_gpu_plan.py`
guards against it.

## Not done

**Activation checkpointing.** It would allow a larger micro-batch, but `Block.forward`
returns `(x, (balance, z, supervised, stats))` where `stats` is a dict, and
`torch.utils.checkpoint` only passes tensors through cleanly. Wiring it up means
restructuring the MoE auxiliary-loss plumbing, which should not be done without a GPU to
verify the aux losses still match. Gradient accumulation already gets the target batch on
a 16GB card, so this is not currently blocking.

## What was verified, and what wasn't

Verified on CPU in this repo: precision selection for every card class, the full
`unscale_ → clip → step → update` ordering with a scaler enabled (including a forced
overflow), scaler state round-tripping, batch planning, and an end-to-end
`prepare → train → resume` run at `--size proto` (loss 7.42 → 6.75, val 7.47 → 6.86 in
30 steps).

**Not verified: an actual fp16 run on real Turing hardware.** No GPU was reachable from
this environment — that is the whole reason this script exists. The scaler sequence is
tested with `GradScaler` enabled on CPU, which exercises the same code path, but the first
real T4 run should be watched for `scaler_skipped_step` in `metrics.jsonl`.
