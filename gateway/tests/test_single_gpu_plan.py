"""The single-GPU launcher's batch plan.

Regression guard for a real bug: the first version's VRAM ceilings sat BELOW the cards
they were meant for (14.0 for a 16GB T4), so a T4 fell through to the next row and got
the A10's larger micro-batch. Reported VRAM is always a little under the marketing
number, so every ceiling must sit just above its card.
"""
import sys
from pathlib import Path

import pytest

RUNNER = Path(__file__).resolve().parents[2] / "infra" / "singlegpu"
sys.path.insert(0, str(RUNNER))

from run_single_gpu import (  # noqa: E402
    BATCH_PLAN,
    CPU_MICRO_BATCH,
    EFFECTIVE_SEQUENCES,
    LARGEST,
    divisors,
    plan_for,
)

SEQ = 2048
TARGET_SEQUENCES = EFFECTIVE_SEQUENCES

# Reported (not marketing) VRAM, as torch.cuda.get_device_properties sees it.
CARDS = {
    "Tesla T4": 15.8,
    "Tesla P100": 16.3,
    "NVIDIA L4": 22.5,
    "NVIDIA A10": 23.0,
    "NVIDIA A100 40GB": 39.6,
    "NVIDIA A100 80GB": 79.2,
    "NVIDIA H100 80GB": 79.6,
}


@pytest.mark.parametrize("card,vram", CARDS.items())
def test_every_card_gets_the_same_effective_batch(card, vram):
    """Micro-batch changes to fit the card; the optimizer's batch must not."""
    batch, accum = plan_for(vram)
    assert batch * accum == TARGET_SEQUENCES, f"{card} would train on a different batch size"
    assert batch * accum * SEQ == 65_536


def test_t4_is_not_given_the_a10_batch():
    """The original bug: a 16GB T4 resolving to the 24GB card's micro-batch."""
    t4 = plan_for(CARDS["Tesla T4"])
    a10 = plan_for(CARDS["NVIDIA A10"])
    assert t4 != a10
    assert t4[0] < a10[0], "a 16GB card must not take the 24GB card's micro-batch"


def test_plan_is_monotonic_in_vram():
    """A bigger card never gets a smaller micro-batch."""
    sizes = sorted(CARDS.values())
    batches = [plan_for(v)[0] for v in sizes]
    assert batches == sorted(batches)


def test_ceilings_are_ordered_and_above_their_cards():
    ceilings = [c for c, _ in BATCH_PLAN]
    assert ceilings == sorted(ceilings), "BATCH_PLAN must be smallest-card-first"
    # whichever row a T4 lands in, that row's ceiling must clear a T4's reported VRAM
    t4 = CARDS["Tesla T4"]
    assert any(c > t4 for c in ceilings), "no row covers a 16GB T4"


def test_every_micro_batch_divides_the_effective_batch():
    """micro x accum must land on EFFECTIVE_SEQUENCES exactly, with no truncation."""
    allowed = set(divisors(EFFECTIVE_SEQUENCES))
    for _, micro in BATCH_PLAN:
        assert micro in allowed, f"micro-batch {micro} does not divide {EFFECTIVE_SEQUENCES}"
    assert LARGEST in allowed
    assert CPU_MICRO_BATCH in allowed


def test_oversized_card_takes_the_whole_step_in_one_micro_batch():
    micro, accum = plan_for(200.0)
    assert micro == LARGEST and accum == 1


def test_small_card_gets_the_smallest_micro_batch():
    batch, accum = plan_for(11.4)   # Colab's occasional ~11GB slice
    assert batch == 2 and accum == TARGET_SEQUENCES // 2


def test_cpu_plan_holds_the_same_effective_batch():
    accum = EFFECTIVE_SEQUENCES // CPU_MICRO_BATCH
    assert CPU_MICRO_BATCH * accum == EFFECTIVE_SEQUENCES
