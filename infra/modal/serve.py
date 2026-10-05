"""
Modal deployment for Artemis vLLM inference.

Serves the Artemis foundation model + LoRA adapters as an OpenAI-compatible
endpoint. Scale-to-zero when idle; H100 spins up on first request (~90s cold start).

Deploy:   modal deploy infra/modal/serve.py
Serve:    modal serve  infra/modal/serve.py   (dev mode, auto-reload)

Secrets required in Modal dashboard (Settings → Secrets → "artemis-secrets"):
  ARTEMIS_INFERENCE_KEY  — bearer token the gateway uses to call this endpoint

Model weights live in a Modal Volume named "artemis-model".
Upload weights once with:  modal run infra/modal/upload_model.py
"""

import os
import subprocess

import modal

app = modal.App("artemis-inference")

# Persistent volume holding model weights and LoRA adapters.
# Layout mirrors serve-on-vm.sh:
#   /model/artemis/           ← base weights
#   /model/artemis/adapters/  ← per-brain LoRA dirs (apollo, mercury, …)
volume = modal.Volume.from_name("artemis-model", create_if_missing=True)

image = (
    modal.Image.from_registry("vllm/vllm-openai:v0.6.6", add_python="3.11")
)

BRAINS = [
    "apollo", "mercury", "venus", "earth", "mars",
    "jupiter", "saturn", "uranus", "neptune", "pluto",
]


@app.function(
    image=image,
    gpu="H100:8",
    volumes={"/model": volume},
    secrets=[modal.Secret.from_name("artemis-secrets")],
    timeout=3600,
    scaledown_window=300,
)
@modal.concurrent(max_inputs=100)
@modal.web_server(port=8000, startup_timeout=180)
def serve():
    model_dir = "/model/artemis"
    api_key = os.environ["ARTEMIS_INFERENCE_KEY"]

    lora_modules = []
    for brain in BRAINS:
        adapter = f"{model_dir}/adapters/{brain}"
        if os.path.isdir(adapter):
            lora_modules += ["--lora-modules", f"{brain}={adapter}"]

    cmd = [
        "python", "-m", "vllm.entrypoints.openai.api_server",
        "--model", model_dir,
        "--served-model-name", "artemis",
        "--tensor-parallel-size", "8",
        "--enable-lora",
        "--max-loras", "10",
        "--max-lora-rank", "64",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--api-key", api_key,
    ] + lora_modules

    subprocess.Popen(cmd)
