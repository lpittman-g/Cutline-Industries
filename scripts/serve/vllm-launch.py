#!/usr/bin/env python3
"""
Launch Artemis via vLLM — no H100 required.

vLLM supports:
  T4   16 GB VRAM  ~$0.35/hr spot  GPT-2-XL (1.5B) bfloat16  ~30-50 tok/s
  A10G 24 GB VRAM  ~$1.50/hr spot  up to 7B fp16               ~60-120 tok/s
  CPU  any RAM     free / ~$20/mo  GPT-2 (117M-1.5B)           ~2-8 tok/s

Usage:
  pip install vllm
  ARTEMIS_MODEL_PATH=./artemis-checkpoint python scripts/serve/vllm-launch.py

  # Or directly via CLI (no H100 needed for small models):
  vllm serve ./artemis-checkpoint \
    --served-model-name artemis \
    --dtype auto \
    --max-model-len 2048 \
    --port 8000

  # CPU-only (no GPU at all):
  vllm serve ./artemis-checkpoint \
    --device cpu \
    --served-model-name artemis \
    --dtype float32 \
    --max-model-len 1024 \
    --port 8000

Once running, set in Vercel / .env:
  VLLM_BASE_URL=http://<your-server-ip>:8000
  VLLM_MODEL=artemis
"""
from __future__ import annotations

import os
import subprocess
import sys

MODEL_PATH = os.environ.get("ARTEMIS_MODEL_PATH", "./artemis-checkpoint")
PORT = int(os.environ.get("ARTEMIS_PORT", "8000"))
DEVICE = os.environ.get("ARTEMIS_DEVICE", "auto")  # auto | cpu | cuda
DTYPE = os.environ.get("ARTEMIS_DTYPE", "auto")    # auto | float16 | bfloat16 | float32
MAX_LEN = int(os.environ.get("ARTEMIS_MAX_LEN", "2048"))
GPU_MEM = float(os.environ.get("ARTEMIS_GPU_MEM_UTIL", "0.85"))  # fraction of VRAM to use

cmd = [
    sys.executable, "-m", "vllm.entrypoints.openai.api_server",
    "--model", MODEL_PATH,
    "--served-model-name", "artemis",
    "--port", str(PORT),
    "--dtype", DTYPE,
    "--max-model-len", str(MAX_LEN),
]

if DEVICE == "cpu":
    cmd += ["--device", "cpu", "--dtype", "float32"]
else:
    cmd += ["--gpu-memory-utilization", str(GPU_MEM)]

print("[vllm-launch] Command:", " ".join(cmd))
print(f"[vllm-launch] Model:  {MODEL_PATH}")
print(f"[vllm-launch] Device: {DEVICE}  Dtype: {DTYPE}  Port: {PORT}")
print()
print("Once running, set:")
print(f"  VLLM_BASE_URL=http://0.0.0.0:{PORT}")
print(f"  VLLM_MODEL=artemis")

subprocess.run(cmd, check=True)
