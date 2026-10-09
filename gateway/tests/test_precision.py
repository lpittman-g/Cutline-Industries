"""Precision selection for single-GPU training.

The machines that matter here differ in one way that breaks training silently: Turing
(T4) has no bf16. Picking bf16 there raises; picking fp16 without a GradScaler lets
gradients underflow to zero and the run quietly learns nothing. These tests pin the
choice for each case without needing the hardware.
"""
import math

import pytest
import torch

from artemis.train import resolve_precision


def fake_cuda(monkeypatch, *, bf16: bool, name: str = "Fake GPU"):
    """Make resolve_precision see a CUDA device with or without bf16."""
    monkeypatch.setattr(torch.cuda, "is_bf16_supported", lambda *a, **k: bf16)
    monkeypatch.setattr(torch.cuda, "get_device_name", lambda *a, **k: name)
    return torch.device("cuda", 0)


def test_cpu_is_fp32_and_needs_no_scaler():
    dtype, scaler, label = resolve_precision(torch.device("cpu"), "auto")
    assert dtype is None and scaler is False
    assert "fp32" in label


def test_cpu_rejects_gpu_only_precision():
    for choice in ("bf16", "fp16"):
        with pytest.raises(SystemExit, match="CUDA"):
            resolve_precision(torch.device("cpu"), choice)


def test_ampere_and_newer_pick_bf16_without_a_scaler(monkeypatch):
    dev = fake_cuda(monkeypatch, bf16=True, name="NVIDIA A100-SXM4-80GB")
    dtype, scaler, label = resolve_precision(dev, "auto")
    assert dtype is torch.bfloat16
    assert scaler is False, "bf16 has fp32's exponent range; a scaler is unnecessary"
    assert label == "bf16"


def test_turing_picks_fp16_with_a_scaler(monkeypatch):
    """A T4 is the free-tier GPU this rework targets."""
    dev = fake_cuda(monkeypatch, bf16=False, name="Tesla T4")
    dtype, scaler, label = resolve_precision(dev, "auto")
    assert dtype is torch.float16
    assert scaler is True, "fp16 gradients underflow to zero without a GradScaler"
    assert "GradScaler" in label


def test_bf16_is_refused_on_a_gpu_that_lacks_it(monkeypatch):
    dev = fake_cuda(monkeypatch, bf16=False, name="Tesla T4")
    with pytest.raises(SystemExit, match="no bf16"):
        resolve_precision(dev, "bf16")


def test_fp16_is_allowed_on_bf16_capable_gpus(monkeypatch):
    """Forcing fp16 on an A100 is legal - useful for reproducing a T4 run."""
    dev = fake_cuda(monkeypatch, bf16=True)
    dtype, scaler, _ = resolve_precision(dev, "fp16")
    assert dtype is torch.float16 and scaler is True


def test_fp32_never_scales(monkeypatch):
    dev = fake_cuda(monkeypatch, bf16=False)
    dtype, scaler, label = resolve_precision(dev, "fp32")
    assert dtype is None and scaler is False and label == "fp32"


def test_scaler_disabled_is_a_passthrough():
    """The non-fp16 paths still call scaler.scale()/step(); disabled, it must not alter values."""
    scaler = torch.amp.GradScaler("cpu", enabled=False)
    loss = torch.tensor(2.5, requires_grad=True)
    assert scaler.scale(loss).item() == pytest.approx(2.5)
    assert scaler.get_scale() == 1.0


def test_scaler_state_round_trips():
    """A resumed fp16 run reloads its scale instead of re-converging on one."""
    a = torch.amp.GradScaler("cpu", enabled=True, init_scale=2.0 ** 12)
    state = a.state_dict()
    b = torch.amp.GradScaler("cpu", enabled=True)
    b.load_state_dict(state)
    assert b.get_scale() == a.get_scale() == 2.0 ** 12


def _tiny_step():
    model = torch.nn.Linear(8, 4)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scaler = torch.amp.GradScaler("cpu", enabled=True, init_scale=2.0 ** 16)
    x, y = torch.randn(16, 8), torch.randn(16, 4)
    loss = torch.nn.functional.mse_loss(model(x), y)
    scaler.scale(loss).backward()
    return model, opt, scaler


def test_clipping_before_unscale_would_destroy_the_gradients():
    """Why train.py calls scaler.unscale_ before clip_grad_norm_ and grad_norms.

    Under fp16 the stored .grad is still multiplied by the scale factor. Clipping a
    scaled norm against max_norm=1.0 shrinks every gradient by the scale (~65536x),
    which looks like training that simply never learns.
    """
    model, opt, scaler = _tiny_step()
    scaled = torch.nn.utils.clip_grad_norm_(model.parameters(), 1e9).item()
    scaler.unscale_(opt)
    true = torch.nn.utils.clip_grad_norm_(model.parameters(), 1e9).item()
    assert scaled / true == pytest.approx(2.0 ** 16, rel=1e-3)
    assert true < 1e4, "the unscaled norm is the real one"


def test_step_applies_when_gradients_are_finite():
    model, opt, scaler = _tiny_step()
    scaler.unscale_(opt)
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    before = [p.detach().clone() for p in model.parameters()]
    scale_before = scaler.get_scale()
    scaler.step(opt)
    scaler.update()
    assert any(not torch.equal(a, b) for a, b in zip(before, model.parameters()))
    assert scaler.get_scale() == scale_before, "no overflow, so the scale holds"


def test_overflow_skips_the_step_and_halves_the_scale():
    """An inf gradient must never reach the weights; train.py logs this as scaler_skipped_step."""
    model, opt, scaler = _tiny_step()
    next(iter(model.parameters())).grad[0, 0] = float("inf")
    scaler.unscale_(opt)
    norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0).item()
    assert not math.isfinite(norm), "this is the inf that must be logged as null"
    before = [p.detach().clone() for p in model.parameters()]
    scale_before = scaler.get_scale()
    scaler.step(opt)
    scaler.update()
    assert all(torch.equal(a, b) for a, b in zip(before, model.parameters())), "weights were corrupted"
    assert scaler.get_scale() == scale_before / 2


def test_nonfinite_grad_norm_is_logged_as_null():
    """An fp16 overflow makes clip_grad_norm_ return inf; json.dumps(inf) is invalid JSON."""
    import json
    for norm in (float("inf"), float("nan")):
        value = round(norm, 3) if math.isfinite(norm) else None
        assert value is None
        assert json.loads(json.dumps({"grad_norm": value}))["grad_norm"] is None
    # a normal value still survives the same expression
    assert round(1.2345, 3) == 1.234 or round(1.2345, 3) == 1.235
