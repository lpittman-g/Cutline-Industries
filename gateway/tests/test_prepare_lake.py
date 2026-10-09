"""Hermetic tests for the lake tokenization sharding logic — no network, no real tokenizer."""
import gzip
import io
import json
from pathlib import Path

import numpy as np
import pytest

from artemis.prepare_lake import ShardWriter, iter_jsonl_gz, tokenize_source


class FakeEncoding:
    def __init__(self, ids):
        self.ids = ids


class FakeTokenizer:
    """One token id per character, deterministic — enough to exercise sharding."""
    def encode(self, text):
        return FakeEncoding([ord(c) % 60000 for c in text])


def test_shardwriter_flushes_at_boundary(tmp_path):
    w = ShardWriter(tmp_path, "uint16", shard_tokens=10)
    w.add(range(25))          # 25 tokens, shard size 10 -> 2 full shards, 5 buffered
    assert w.index == 2
    assert (tmp_path / "shard_00000.bin").exists()
    assert (tmp_path / "shard_00001.bin").exists()
    assert not (tmp_path / "shard_00002.bin").exists()
    w.close()                 # flush remaining 5
    assert w.index == 3
    assert w.total == 25
    s0 = np.fromfile(tmp_path / "shard_00000.bin", dtype="uint16")
    assert s0.tolist() == list(range(10))
    s2 = np.fromfile(tmp_path / "shard_00002.bin", dtype="uint16")
    assert s2.tolist() == [20, 21, 22, 23, 24]


def test_shardwriter_resume_start_index(tmp_path):
    w = ShardWriter(tmp_path, "uint16", shard_tokens=5, start_index=7)
    w.add(range(5))
    assert (tmp_path / "shard_00007.bin").exists()
    assert w.index == 8


def test_shardwriter_uploader_removes_local(tmp_path):
    uploaded = []
    w = ShardWriter(tmp_path, "uint16", shard_tokens=4,
                    uploader=lambda p, name: uploaded.append(name))
    w.add(range(8))
    assert uploaded == ["shard_00000.bin", "shard_00001.bin"]
    assert not (tmp_path / "shard_00000.bin").exists()  # deleted after upload


def test_dtype_roundtrip_uint32(tmp_path):
    w = ShardWriter(tmp_path, "uint32", shard_tokens=3)
    w.add([70000, 80000, 90000])  # values > uint16 max must survive
    w.close()
    got = np.fromfile(tmp_path / "shard_00000.bin", dtype="uint32")
    assert got.tolist() == [70000, 80000, 90000]


def test_iter_jsonl_gz_dedups_and_skips_blank(tmp_path):
    rows = [{"text": "hello"}, {"text": ""}, {"text": "hello"}, {"other": "x"}, {"text": "world"}]
    raw = gzip.compress(("\n".join(json.dumps(r) for r in rows)).encode())
    out = list(iter_jsonl_gz(raw, "text"))
    assert out == ["hello", "world"]  # blank skipped, dup "hello" removed, missing field skipped


def test_tokenize_source_appends_eos(tmp_path):
    w = ShardWriter(tmp_path, "uint16", shard_tokens=1000)
    n = tokenize_source(["ab", "c"], FakeTokenizer(), eos=42, writer=w)
    w.close()
    assert n == 2
    got = np.fromfile(tmp_path / "shard_00000.bin", dtype="uint16").tolist()
    # "ab"+eos, "c"+eos  ->  [97,98,42, 99,42]
    assert got == [97, 98, 42, 99, 42]


def test_malformed_json_line_skipped():
    raw = gzip.compress(b'{"text": "ok"}\nnot json\n{"text": "fine"}')
    assert list(iter_jsonl_gz(raw, "text")) == ["ok", "fine"]
