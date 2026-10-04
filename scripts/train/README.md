# Artemis Model Weights

Two paths to get real inference running:

## Path A — instant (no training, ~5 min)

Sets `ARTEMIS_MODEL_PATH=gpt2` on the Azure Container App.
The server downloads GPT-2 base (117 M params, ~500 MB) from HuggingFace on first start.
Generation quality is generic until you fine-tune (Path B), but the API returns real text immediately.

```bash
az login
bash scripts/train/deploy-weights.sh --base
```

Then watch the container start:
```bash
az containerapp logs show \
  --name artemis-api \
  --resource-group <your-rg> \
  --follow
```

You will see `[artemis-serve] Ready on port 8100` when it is live.

---

## Path B — fine-tuned Cutline Industries weights (~30–60 min CPU)

1. **Build the corpus** (generates `data/artemis-corpus.jsonl`):
   ```bash
   python scripts/train/corpus.py
   ```

2. **Fine-tune** (saves to `./artemis-checkpoint`):
   ```bash
   pip install torch transformers
   python scripts/train/train.py
   ```
   Tune with env vars:
   ```
   BASE_MODEL=gpt2          # or gpt2-medium, gpt2-large
   EPOCHS=5
   BATCH_SIZE=2
   LR=5e-5
   ```

3. **Deploy** (requires ACR and az login):
   ```bash
   ACR=cutlineacr.azurecr.io bash scripts/train/deploy-weights.sh --fine
   ```

---

## Local test

```bash
pip install torch transformers
ARTEMIS_MODEL_PATH=gpt2 python scripts/serve/artemis-serve.py &
curl -s -X POST http://localhost:8100/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is Artemis?"}' | python -m json.tool
```

---

## Hardware

| Model       | Params | RAM needed | Speed (CPU) | Speed (T4 GPU) |
|-------------|--------|------------|-------------|----------------|
| gpt2        | 117 M  | 1 GB       | ~3 tok/s    | —              |
| gpt2-medium | 345 M  | 2 GB       | ~1.5 tok/s  | ~40 tok/s      |
| gpt2-large  | 774 M  | 4 GB       | ~0.8 tok/s  | ~25 tok/s      |
| gpt2-xl     | 1.5 B  | 8 GB       | ~0.4 tok/s  | ~15 tok/s      |

The H100 (~$98/hr) is not needed for any of these. Confirm with the user before starting it.
