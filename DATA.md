# Artemis Training Data Catalog

This repo holds the **pipeline and catalog**. The data itself lives in Azure Data
Lake Storage Gen2 (`artemistrainingdata`), not in git — the datasets total 100+ TB,
far beyond what any git repo can hold.

## Where the data lives

- **Storage account:** `artemistrainingdata` (ADLS Gen2, Hot tier, East US)
- **DFS endpoint:** `https://artemistrainingdata.dfs.core.windows.net/`
- **Containers:** `raw-data`, `processed-data`, `datasets`, `checkpoints`, `logs`
- **Provenance manifest (source of truth):** `datasets/_provenance/manifest.csv`

## Dataset inventory

Decisions apply the standard: the "no outside AI models" rule covers training data,
so wholly AI-generated sets are excluded. See `manifest.csv` for the authoritative row-per-dataset record.

| Dataset | Origin | Decision | License | Lake path |
|---------|--------|----------|---------|-----------|
| FineWeb | human web text | IN | ODC-By 1.0 | `datasets/fineweb/` |
| FineWeb-Edu | human web text | IN | ODC-By 1.0 | `datasets/fineweb-edu/` |
| Dolma | human mixed | IN | ODC-BY | `datasets/dolma/` |
| DCLM-Baseline | human web | IN | CC-BY 4.0 | `datasets/dclm/` |
| RedPajama-V2 | human web | IN | mixed per-source | `datasets/redpajama/` |
| The Stack v2 | human code (gated) | IN | OpenRAIL / SWH | `datasets/the-stack-v2/` |
| StarCoderData | human code (gated) | IN | various | `datasets/starcoderdata/` |
| FineMath | human web | IN | ODC-By 1.0 | `datasets/finemath/` |
| ROOTS | human multilingual (gated) | IN | mixed | `datasets/roots/` |
| Wikipedia | human text | IN | CC-BY-SA 3.0 | `datasets/wikipedia/` |
| Aya Collection | mixed human/synthetic | FILTER | Apache 2.0 | `datasets/aya/` |
| Cosmopedia | AI-generated | OUT | ODC-By 1.0 | excluded |
| HH-RLHF | AI-generated | OUT | MIT | landed, pending deletion |
| HelpSteer2 | AI-generated | OUT | CC-BY 4.0 | landed, pending deletion |
| WebGPT Comparisons | AI-generated | OUT | unclear | excluded |
| Summarize from Feedback | AI-generated | OUT | CC-BY 4.0 | excluded |

## Ingest pipeline

- `pipeline/ingest.py` — streams a dataset from its source straight into the lake
  (no local disk), resumable, retries with backoff. One systemd job per dataset.
- `pipeline/artemis-ingest@.service` — systemd template; `systemctl start artemis-ingest@fineweb`
- `pipeline/watcher.sh` — watches `/data/inbox` on the ingest VM, auto-uploads to `raw-data/`
- `pipeline/upload.sh` — manual upload helper

### How to pull a dataset
```bash
# On the ingest VM (artemis-ingest-agent):
systemctl start artemis-ingest@<job>     # fineweb | dolma | aya | ...
journalctl -u artemis-ingest@<job> -f    # watch progress
```

## Access model

- Storage key → Azure Key Vault `cutline-kv-comms` (`artemistrainingdata-storage-key`)
- VM-scoped SAS tokens (write-only, 30-day) at `/etc/artemis/sas-*` on the ingest VM
- Datasets gated by Hugging Face terms (The Stack, ROOTS) require manual acceptance

## Notes

- Costs scale with stored volume (~$0.018/GB/mo Hot). The 90 PB ceiling is capacity,
  not committed spend — you pay for what is actually stored.
- Gated datasets need a Hugging Face account to accept terms before download.
