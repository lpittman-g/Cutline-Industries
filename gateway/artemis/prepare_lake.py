"""Lake-scale tokenization: stream datasets from ADLS Gen2, tokenize, write token shards back.

The in-memory `data.prepare()` holds every token in a Python list, so it cannot process a
multi-TB corpus. This streams each source blob, tokenizes incrementally, and flushes fixed-size
`.bin` shards (uint16/uint32) that `data.TokenStream` can memmap directly — identical on-disk
format, so training code is unchanged.

Resumable: a per-dataset `_progress.json` records which source blobs are fully consumed and the
next shard index, so a restarted job skips finished work. Dedup is per-source-blob (exact line
hash); global dedup across a 44 TB corpus is a separate offline pass, not attempted here.

Run one dataset per process (one systemd job each) so datasets tokenize in parallel:
    python -m artemis.prepare_lake fineweb --tokenizer /path/to/tokenizer.json
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import logging
from pathlib import Path
from typing import Callable, Iterable, Iterator, Optional

import numpy as np

log = logging.getLogger("prepare_lake")

# dataset specs: how to find and read each source in the lake
SPECS = {
    "fineweb": {"container": "datasets", "prefix": "fineweb/", "format": "parquet", "text_field": "text",
                "license": "ODC-By-1.0", "origin": "human_web_text"},
    "dolma": {"container": "datasets", "prefix": "dolma/", "format": "jsonl.gz", "text_field": "text",
              "license": "ODC-BY", "origin": "human_mixed"},
    "aya": {"container": "datasets", "prefix": "aya/", "format": "jsonl.gz", "text_field": "inputs",
            "license": "Apache-2.0", "origin": "mixed_human_synthetic"},
}


class ShardWriter:
    """Accumulate token ids; flush fixed-size .bin shards. Pure logic — inject `uploader` for I/O."""

    def __init__(self, out_dir: Path, dtype: str, shard_tokens: int,
                 start_index: int = 0, uploader: Optional[Callable[[Path, str], None]] = None):
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.dtype = dtype
        self.shard_tokens = shard_tokens
        self.index = start_index
        self.uploader = uploader
        self.buf: list[int] = []
        self.total = 0

    def add(self, ids: Iterable[int]) -> None:
        self.buf.extend(ids)
        while len(self.buf) >= self.shard_tokens:
            self._flush(self.buf[:self.shard_tokens])
            del self.buf[:self.shard_tokens]

    def _flush(self, tokens: list[int]) -> str:
        name = f"shard_{self.index:05d}.bin"
        path = self.out_dir / name
        np.array(tokens, dtype=self.dtype).tofile(path)
        self.total += len(tokens)
        if self.uploader:
            self.uploader(path, name)
            path.unlink(missing_ok=True)  # don't keep shards on local disk after upload
        self.index += 1
        return name

    def close(self) -> None:
        """Flush the final partial shard (if any tokens remain)."""
        if self.buf:
            self._flush(self.buf)
            self.buf = []


def iter_jsonl_gz(raw: bytes, text_field: str) -> Iterator[str]:
    seen: set[str] = set()
    with gzip.open(io.BytesIO(raw), "rt", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = rec.get(text_field)
            if not text:
                continue
            h = hashlib.sha256(text.encode()).hexdigest()
            if h in seen:  # per-blob exact-duplicate removal
                continue
            seen.add(h)
            yield text


def iter_parquet(local_path: Path, text_field: str) -> Iterator[str]:
    import pyarrow.parquet as pq
    pf = pq.ParquetFile(local_path)
    for batch in pf.iter_batches(columns=[text_field], batch_size=2048):
        for text in batch.column(0).to_pylist():
            if text:
                yield text


def tokenize_source(texts: Iterable[str], tokenizer, eos: int, writer: ShardWriter) -> int:
    n_docs = 0
    for text in texts:
        writer.add(tokenizer.encode(text).ids + [eos])
        n_docs += 1
    return n_docs


def _load_progress(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text())
    return {"done_blobs": [], "next_shard": 0, "total_tokens": 0}


def run(job: str, tokenizer_path: str, shard_tokens: int = 256_000_000,
        work_dir: str = "/data/tok", lake=None) -> dict:
    """Tokenize one dataset end to end. `lake` is a BlobLake (ADLS wrapper); None = dry run shape only."""
    from .tokenizer import load_tokenizer
    spec = SPECS[job]
    tok = load_tokenizer(tokenizer_path)
    eos = tok.token_to_id("<|eos|>")
    dtype = "uint32" if tok.get_vocab_size() > 65535 else "uint16"
    work = Path(work_dir) / job
    work.mkdir(parents=True, exist_ok=True)
    prog_path = work / "_progress.json"
    prog = _load_progress(prog_path)

    uploader = lake.uploader(spec["container"], f"processed-data/{job}") if lake else None
    writer = ShardWriter(work, dtype, shard_tokens, start_index=prog["next_shard"], uploader=uploader)

    blobs = lake.list(spec["container"], spec["prefix"]) if lake else []
    for blob in blobs:
        if blob in prog["done_blobs"]:
            continue
        if spec["format"] == "jsonl.gz":
            texts = iter_jsonl_gz(lake.get(spec["container"], blob), spec["text_field"])
            n = tokenize_source(texts, tok, eos, writer)
        else:  # parquet: download to a temp file (pyarrow needs random access)
            local = work / "_cur.parquet"
            lake.download(spec["container"], blob, local)
            n = tokenize_source(iter_parquet(local, spec["text_field"]), tok, eos, writer)
            local.unlink(missing_ok=True)
        prog["done_blobs"].append(blob)
        prog["next_shard"] = writer.index
        prog["total_tokens"] = writer.total
        prog_path.write_text(json.dumps(prog))
        log.info("%s: %s -> %d docs, %d shards, %.2fB tokens", job, blob, n, writer.index, writer.total / 1e9)

    writer.close()
    manifest = {"dataset": job, "license": spec["license"], "origin": spec["origin"],
                "tokenizer_sha256": hashlib.sha256(Path(tokenizer_path).read_bytes()).hexdigest(),
                "dtype": dtype, "shard_tokens": shard_tokens, "shards": writer.index,
                "total_tokens": writer.total}
    if lake:
        lake.put_text(spec["container"], f"processed-data/{job}/manifest.json",
                      json.dumps(manifest, indent=2))
    log.info("%s DONE: %d shards, %.2fB tokens", job, writer.index, writer.total / 1e9)
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("job", choices=SPECS)
    ap.add_argument("--tokenizer", required=True)
    ap.add_argument("--shard-tokens", type=int, default=256_000_000)
    ap.add_argument("--work-dir", default="/data/tok")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    from .lake_io import BlobLake  # thin ADLS wrapper, SAS from /etc/artemis
    run(args.job, args.tokenizer, args.shard_tokens, args.work_dir, lake=BlobLake.from_env())


if __name__ == "__main__":
    main()
