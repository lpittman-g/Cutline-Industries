# Artemis training cluster (Azure ML)

Ready-to-run specs for pretraining Artemis on one 8×H100 node. Nothing here provisions
GPUs or incurs cost until you submit the job — and the H100 spin-up (~$98.32/hr, the rate
already in `gateway/configs/engine.yaml`) stays a deliberate, separate step.

## Prerequisites (in order)

1. **GPU quota** — `standardNDSH100v5Family` = 96 vCPUs in East US, approved.
   Request it at portal.azure.com → Quotas (no support plan needed). Until this clears,
   the cluster cannot allocate its node.
2. **Token shards in the lake** — run `prepare_lake` so `processed-data/<dataset>/` holds
   `shard_*.bin` + `manifest.json`. Needs a trained tokenizer and the ingested datasets.
3. **A trained tokenizer** committed/available to the job.

## Deploy

```bash
RG=artm-rg; WS=artemis-aml

# 1. Datastore (key pulled from Key Vault, never written to git)
az ml datastore create -f datastore.yml -g $RG -w $WS \
  --set credentials.account_key="$(az keyvault secret show --vault-name cutline-kv-comms \
    --name artemistrainingdata-storage-key --query value -o tsv)"

# 2. Environment (torch+CUDA image + Artemis deps)
az ml environment create -f environment.yml -g $RG -w $WS

# 3. Compute cluster — min_instances:0, so $0 until a job runs
az ml compute create -f compute-ndh100v5.yml -g $RG -w $WS

# 4. Submit the first ramp stage (THIS is the step that starts billing ~$98/hr)
az ml job create -f train-job.yml -g $RG -w $WS
```

## Cost & guardrails

- The cluster idles at **$0** (`min_instances: 0`). Only step 4 — `az ml job create` —
  provisions the node and starts the ~$98.32/hr charge. It stops when the job ends and the
  node scales down after 15 min idle.
- `engine.yaml` holds the real governor: `monthly_cap_usd: 2000000`, the ramp
  `[1, 4, 16, 27]` VMs, and promotion margin. Advance sizes only after a stable, improving run.

## The ramp

Start at `100m` on 1 node (this job). To advance, change `size` and the `shards` path in
`train-job.yml` (100m → 1b → 3b → 8b) and resubmit; `train.py` resumes from the latest
checkpoint in the `checkpoints/<size>/` output.

## Data bridge

`train.py` reads one `train.bin`/`val.bin`; the lake stores per-dataset shards. `launch.sh`
concatenates a `--token-budget` subset of shards onto the node's local NVMe (valid because
raw token shards share one dtype) and holds the last shard out for validation. For runs whose
token budget exceeds local NVMe (~28 TB), a multi-shard streaming reader is the follow-up —
noted, not yet built.
