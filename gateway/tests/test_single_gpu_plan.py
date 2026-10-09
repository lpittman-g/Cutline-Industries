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

from run_single_gpu import BATCH_PLAN, LARGEST, plan_for  # noqa: E402

SEQ = 2048
TARGET_SEQUENCES = 32

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
    assert t4[0] == 4, "a 16GB T4 should take 4 sequences per micro-step"
    assert a10[0] == 8


def test_plan_is_monotonic_in_vram():
    """A bigger card never gets a smaller micro-batch."""
    sizes = sorted(CARDS.values())
    batches = [plan_for(v)[0] for v in sizes]
    assert batches == sorted(batches)


def test_ceilings_are_ordered_and_above_their_cards():
    ceilings = [c for c, _, _ in BATCH_PLAN]
    assert ceilings == sorted(ceilings), "BATCH_PLAN must be smallest-card-first"
    # the T4 row's ceiling has to clear a T4's reported VRAM
    t4_row = next(c for c, b, _ in BATCH_PLAN if b == 4)
    assert t4_row > CARDS["Tesla T4"]


def test_largest_row_also_holds_the_batch_invariant():
    assert LARGEST[0] * LARGEST[1] == TARGET_SEQUENCES


def test_oversized_card_falls_through_to_largest():
    assert plan_for(200.0) == LARGEST


def test_small_card_gets_the_smallest_micro_batch():
    batch, accum = plan_for(11.4)   # Colab's occasional ~11GB slice
    assert batch == 2 and accum == 16
