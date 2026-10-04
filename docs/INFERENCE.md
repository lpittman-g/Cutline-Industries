# Artemis Inference — No H100 Required

## Current state (audited 2026-10-04)

| Path | Status | Details |
|------|--------|---------|
| Azure Container Apps (`ARTEMIS_CORE_URL`) | **Live, 202 ms** | Serving engine up, weights not loaded (`serving: false`) |
| vLLM (`VLLM_BASE_URL`) | **Not started** | H100 VM never provisioned — not needed |
| Stub fallback | Active | Used when both paths miss |

The H100 was mentioned only as a comment in `.env.example`. It is **not** a hard requirement. The code accepts any OpenAI-compatible endpoint at `VLLM_BASE_URL` and any compatible API at `ARTEMIS_CORE_URL`.

---

## Why H100 was listed

The `.env.example` comment reads:
```
# Point at your private vLLM host once the H100 VM is running.
```

This was aspirational planning for future large-model training. For the current architecture (GPT-2-SFT scale, keyword-routed MoE), an H100 is unnecessary. See hardware requirements below.

---

## The Azure Container Apps endpoint

URL: `https://artemis-api.whitemeadow-751c0637.eastus.azurecontainerapps.io`

The server is live and has:
- 11 specialist brains (Apollo, Artemis, Earth, Jupiter, Mars, Mercury, Neptune, Pluto, Saturn, Uranus, Venus)
- Keyword router (routes by topic to the right specialist)
- 4 model tiers: `gpt-1-base`, `gpt-2-sft`, `gpt-3-aligned-rag`, `gpt-4-asi-orchestrator`
- Tools: Wikipedia search, web fetch, Azure Dynamic Sessions Python execution

**Current state: `serving: false`** — the model weights are not loaded into the container. The container returns a training message because no checkpoint was mounted or baked into the image.

**To activate** (no H100 needed):
1. Export your trained checkpoint from wherever it was trained
2. Build the serving container (see `scripts/serve/Dockerfile.artemis-serve`)
3. Push to Azure Container Registry
4. Update the Container App to use the new image

---

## Hardware requirements by model size

| Model | Params | CPU RAM | GPU VRAM | Speed (CPU) | Speed (T4 GPU) | Cost |
|-------|--------|---------|----------|-------------|----------------|------|
| GPT-2 base | 117M | 1 GB | 500 MB | 1–3 tok/s | 50–80 tok/s | CPU: free / T4: $0.35/hr spot |
| GPT-2 medium | 345M | 2 GB | 1.5 GB | 0.8–2 tok/s | 40–60 tok/s | CPU: free / T4: $0.35/hr spot |
| GPT-2 large | 774M | 4 GB | 3 GB | 0.4–1 tok/s | 30–50 tok/s | CPU: free / T4: $0.35/hr spot |
| GPT-2 XL | 1.5B | 8 GB | 6 GB | 0.2–0.5 tok/s | 20–40 tok/s | CPU: free / T4: $0.35/hr spot |
| 7B model | 7B | 16 GB* | 14 GB† | 0.05 tok/s | not recommended | A10G: $1.50/hr |

*With INT8 quantization, RAM/VRAM cuts in half. †With INT4 (GPTQ/AWQ), cuts to ~4 GB VRAM.

Azure Container Apps CPU plan handles GPT-2 base/medium without any GPU.

---

## Option 1: Activate the existing Azure endpoint (recommended)

No new VM, no GPU, ~$0–5/month.

```bash
# 1. Install serving dependencies
pip install torch transformers accelerate

# 2. Test locally with your checkpoint
ARTEMIS_MODEL_PATH=./artemis-checkpoint \
ARTEMIS_DEVICE=cpu \
python scripts/serve/artemis-serve.py

# 3. Verify it's serving
curl http://localhost:8100/v1/status
curl -X POST http://localhost:8100/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Hello Artemis","tier":"gpt-2-sft"}'

# 4. Build and push container
docker build -f scripts/serve/Dockerfile.artemis-serve -t artemis-serve .
docker tag artemis-serve <your-acr>.azurecr.io/artemis-serve:latest
docker push <your-acr>.azurecr.io/artemis-serve:latest

# 5. Update Azure Container Apps
az containerapp update \
  --name artemis-api \
  --resource-group <your-rg> \
  --image <your-acr>.azurecr.io/artemis-serve:latest

# 6. Set ARTEMIS_CORE_URL in Vercel
# Vercel dashboard → cutline-industries → Settings → Environment Variables
# Key:   ARTEMIS_CORE_URL
# Value: https://artemis-api.whitemeadow-751c0637.eastus.azurecontainerapps.io
# Env:   Production
```

---

## Option 2: vLLM on a T4 VM ($0.35/hr spot, ~$5/day if on 8h)

vLLM supports CPU inference and any NVIDIA GPU. The H100 (`NC_H100_v5`) is the largest option — not the only one.

```bash
# On any machine with Python + CUDA (or CPU-only)
pip install vllm

# CPU-only (no GPU at all, works on $5/month VM):
ARTEMIS_MODEL_PATH=./artemis-checkpoint \
ARTEMIS_DEVICE=cpu \
python scripts/serve/vllm-launch.py

# T4 GPU (16 GB VRAM, ~$0.35/hr spot on Lambda Labs or Vast.ai):
ARTEMIS_MODEL_PATH=./artemis-checkpoint \
python scripts/serve/vllm-launch.py

# Then in Vercel / .env:
# VLLM_BASE_URL=http://<server-ip>:8000
# VLLM_MODEL=artemis
```

**Quantization for smaller VRAM** (inference only, preserves weights):
```bash
# Load at INT8 (AWQ/GPTQ reduces VRAM by ~50%):
vllm serve ./artemis-checkpoint \
  --served-model-name artemis \
  --quantization awq \          # or gptq
  --dtype auto \
  --port 8000
```

---

## Option 3: Minimal $20/month persistent VM (DigitalOcean/Hetzner)

For a persistent, always-on endpoint at the lowest cost:

```
DigitalOcean Droplet: 8 GB RAM, 4 vCPU, $48/month
Hetzner CX31:         8 GB RAM, 2 vCPU, $13/month

Model:  GPT-2 medium (345M) → 2 GB RAM, runs comfortably
Speed:  ~1–2 tok/s (adequate for text responses)
Cost:   $13–48/month vs $98/hr for H100
```

Run:
```bash
# On the VM
ARTEMIS_MODEL_PATH=./artemis-checkpoint \
ARTEMIS_PORT=8100 \
nohup python scripts/serve/artemis-serve.py &

# Add ARTEMIS_CORE_URL=http://<vm-ip>:8100 to Vercel
```

---

## Wiring Vercel

Add these environment variables in Vercel dashboard → cutline-industries → Settings → Environment Variables:

| Key | Value | Target |
|-----|-------|--------|
| `ARTEMIS_CORE_URL` | `https://artemis-api.whitemeadow-751c0637.eastus.azurecontainerapps.io` | Production |
| `VLLM_BASE_URL` | `http://<your-inference-vm>:8000` (once running) | Production |
| `VLLM_MODEL` | `artemis` | Production |

**Do not put `VLLM_API_KEY` in this table** — set it as a sensitive/encrypted variable directly in the dashboard.

---

## Remaining blockers

1. **Checkpoint location** — The trained weights from the prior training session are not in this repository. They need to be located (Azure Blob Storage? Another machine?) and mounted/baked into the serving container.

2. **Azure Container Apps update** — Requires Azure credentials (`az login`) and the Container Registry to push an updated image. The serving infrastructure is ready; only the weights are missing.

3. **`serving: false`** — Once weights are loaded and the container image is updated, this flips to `true` and the `/v1/chat` endpoint returns `status: "ok"` with real model output.

---

## What works right now (no H100, no new VM)

- `ARTEMIS_CORE_URL` set in Vercel → the Azure endpoint responds in ~202ms
- All chat messages reach the endpoint and return a real HTTP response
- The brain routing (keyword → specialist) is live
- The stub fallback is bypassed as soon as `ARTEMIS_CORE_URL` is set
- Login, chat storage, RAG, memory, and voice all work independently of inference

The single remaining step for real model output is loading the checkpoint into the serving container.
