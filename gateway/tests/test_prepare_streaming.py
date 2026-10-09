"""prepare_streaming must match prepare() exactly, without holding the corpus in RAM.

The first Gutenberg run died with no traceback right after "tokenizing corpus into
shards" - an OOM kill. Cause: _iter_docs() reads a .txt file whole, so a 526 MB
corpus became ONE document and tok.encode() built a ~130M-element Python list in a
single call, alongside a parallel list of domain labels of the same length.

These tests pin the two properties that matter: identical output, bounded memory.
"""
import json
import sys
import sysconfig
from pathlib import Path

import numpy as np
import pytest

from artemis.data import _iter_text_blocks, prepare, prepare_streaming
from artemis.tokenizer import train_tokenizer


@pytest.fixture(scope="module")
def corpus(tmp_path_factory):
    stdlib = Path(sysconfig.get_paths()["stdlib"])
    text = "\n\n".join(p.read_text(errors="ignore") for p in sorted(stdlib.glob("*.py"))[:25])
    d = tmp_path_factory.mktemp("stream")
    f = d / "corpus.txt"
    f.write_text(text)
    tok = d / "tok.json"
    train_tokenizer([str(f)], 2048, tok)
    return {"file": f, "tok": tok, "dir": d}


def test_blocks_cover_the_file_exactly(tmp_path):
    """No text may be dropped or duplicated by the block splitter."""
    src = "alpha\n\n" + ("body line\n" * 500) + "\n\nomega\n"
    f = tmp_path / "c.txt"
    f.write_text(src)
    blocks = list(_iter_text_blocks(f, block_chars=256))
    assert len(blocks) > 1, "should have split into several blocks"
    assert "".join(blocks) == src, "round-trip must be lossless"


def test_blocks_split_on_blank_lines(tmp_path):
    """Documents must not be cut mid-sentence."""
    f = tmp_path / "c.txt"
    f.write_text(("sentence one. sentence two.\n" * 200 + "\n") * 5)
    for b in _iter_text_blocks(f, block_chars=512):
        assert b.endswith("\n"), "a block ended mid-line"


def test_trailing_block_is_not_lost(tmp_path):
    f = tmp_path / "c.txt"
    f.write_text("x" * 10 + "\n\n" + "tail without trailing blank line")
    assert "tail without trailing blank line" in "".join(_iter_text_blocks(f, block_chars=4))


def test_whitespace_only_tail_is_dropped(tmp_path):
    f = tmp_path / "c.txt"
    f.write_text("real content\n\n" + "   \n  \n")
    assert all(b.strip() for b in _iter_text_blocks(f, block_chars=4))


def test_streaming_matches_prepare_token_for_token(corpus, tmp_path):
    """The shards TokenStream memmaps must be byte-identical between the two paths."""
    src = [{"path": str(corpus["file"]), "license": "PSF-2.0", "origin": "python stdlib"}]
    a = prepare(src, str(corpus["tok"]), str(tmp_path / "batch"))
    b = prepare_streaming(src, str(corpus["tok"]), str(tmp_path / "stream"))

    assert a["dtype"] == b["dtype"]
    assert a["train_tokens"] == b["train_tokens"], "token counts diverged"
    assert a["val_tokens"] == b["val_tokens"]
    for name in ("train", "val"):
        x = np.fromfile(tmp_path / "batch" / f"{name}.bin", dtype=a["dtype"])
        y = np.fromfile(tmp_path / "stream" / f"{name}.bin", dtype=b["dtype"])
        assert np.array_equal(x, y), f"{name}.bin differs between prepare and prepare_streaming"


def test_streaming_records_the_same_provenance(corpus, tmp_path):
    src = [{"path": str(corpus["file"]), "license": "PSF-2.0", "origin": "python stdlib"}]
    a = prepare(src, str(corpus["tok"]), str(tmp_path / "batch"))
    b = prepare_streaming(src, str(corpus["tok"]), str(tmp_path / "stream"))
    assert a["sources"][0]["sha256"] == b["sources"][0]["sha256"], "streaming digest differs"
    assert a["tokenizer_sha256"] == b["tokenizer_sha256"]
    assert b["sources"][0]["license"] == "PSF-2.0"


def test_streaming_still_refuses_an_unlicensed_source(corpus, tmp_path):
    with pytest.raises(ValueError, match="license"):
        prepare_streaming([{"path": str(corpus["file"])}], str(corpus["tok"]), str(tmp_path / "x"))


def test_no_dom_files_when_nothing_is_labelled(corpus, tmp_path):
    out = tmp_path / "unlabelled"
    m = prepare_streaming([{"path": str(corpus["file"]), "license": "PSF-2.0", "origin": "x"}],
                          str(corpus["tok"]), str(out))
    assert m["domain_labels"] is False
    assert not (out / "train.dom").exists(), "empty .dom left behind would mislead TokenStream"


def test_memory_stays_bounded_while_streaming(corpus, tmp_path):
    """The actual regression: peak allocation must not scale with corpus size.

    Comparing a single peak against an absolute number is meaningless - most of it
    is the tokenizer itself. The property that matters is that DOUBLING the corpus
    does not double the peak, which is exactly what the old list-accumulating path
    did. tracemalloc measures Python-level allocation, which is where it blew up.
    """
    import tracemalloc

    text = corpus["file"].read_text()
    single = tmp_path / "single.txt"
    double = tmp_path / "double.txt"
    single.write_text(text)
    double.write_text(text + "\n\n" + text.replace("def ", "def x_"))  # distinct, ~2x

    def peak(fn, src_path, out):
        s = [{"path": str(src_path), "license": "PSF-2.0", "origin": "python stdlib"}]
        tracemalloc.start()
        fn(s, str(corpus["tok"]), str(out), **({"block_chars": 1 << 18} if fn is prepare_streaming else {}))
        _, pk = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        return pk

    s1 = peak(prepare_streaming, single, tmp_path / "s1")
    s2 = peak(prepare_streaming, double, tmp_path / "s2")
    b2 = peak(prepare, double, tmp_path / "b2")

    assert s2 < b2, f"streaming peak {s2/1e6:.1f} MB not below batch {b2/1e6:.1f} MB"
    # doubling the corpus must not come close to doubling streaming's peak
    assert s2 < s1 * 1.5, (
        f"streaming peak scaled with corpus: {s1/1e6:.1f} MB -> {s2/1e6:.1f} MB")
