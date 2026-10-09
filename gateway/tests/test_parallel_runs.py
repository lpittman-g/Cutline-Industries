"""Core partitioning for concurrent training runs.

Running several configs at once beats putting a GPU and a CPU box in one
data-parallel job: synchronous steps run at the slowest rank's pace, so an equal
split lands at ~0.19x the GPU alone and even a perfect speed-proportional split
only reaches ~1.10x, before counting a 612 MB per-step gradient all-reduce.

The thing that can go wrong with independent runs is thread oversubscription: N
workers each spawning one thread per core makes every run slower. These tests pin
the partitioning so the total never exceeds the cores available.
"""
import sys
from pathlib import Path

import pytest

RUNNER = Path(__file__).resolve().parents[2] / "infra" / "singlegpu"
sys.path.insert(0, str(RUNNER))

from run_parallel import CORES_FOR_GPU_HOST, plan_workers, search_lrs  # noqa: E402


@pytest.mark.parametrize("cores", [1, 2, 4, 8, 16, 48, 96])
@pytest.mark.parametrize("workers", [0, 1, 2, 3, 5])
@pytest.mark.parametrize("gpu", [False, True])
def test_never_oversubscribes_cores(cores, workers, gpu):
    gpu_cores, split = plan_workers(cores, workers, gpu)
    assert gpu_cores + sum(split) <= cores
    assert all(c >= 1 for c in split), "a worker with zero cores would never progress"


def test_cores_are_fully_used_when_there_is_work():
    """Whatever is left after the GPU host thread goes to the CPU workers."""
    gpu_cores, split = plan_workers(48, 3, use_gpu=True)
    assert gpu_cores == CORES_FOR_GPU_HOST
    assert sum(split) == 48 - CORES_FOR_GPU_HOST
    assert split == [16, 15, 15], "remainder spread across workers, not dropped"


def test_cpu_only_gives_every_core_to_the_workers():
    gpu_cores, split = plan_workers(48, 1, use_gpu=False)
    assert gpu_cores == 0 and split == [48]


def test_workers_are_capped_at_one_core_each():
    """Asking for more workers than cores must not create zero-core workers."""
    _, split = plan_workers(8, 10, use_gpu=False)
    assert len(split) == 8 and split == [1] * 8


def test_no_cpu_workers_requested():
    gpu_cores, split = plan_workers(48, 0, use_gpu=True)
    assert split == [] and gpu_cores == CORES_FOR_GPU_HOST


def test_tiny_host_still_serves_the_gpu():
    """On a 2-core host the GPU run takes the cores; no CPU worker is starved in."""
    gpu_cores, split = plan_workers(2, 1, use_gpu=True)
    assert gpu_cores == 2 and split == []


def test_no_gpu_and_no_workers_yields_nothing():
    assert plan_workers(48, 0, use_gpu=False) == (0, [])


def test_learning_rates_come_from_the_engine_search_space():
    """A sweep should explore the same grid the ramp engine does."""
    lrs = search_lrs()
    assert len(lrs) >= 2
    assert all(isinstance(x, float) and 0 < x < 1 for x in lrs)
    assert lrs == sorted(lrs)
