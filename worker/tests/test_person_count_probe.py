"""Person-count probe on the two-person fixture (skipped when missing)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

_V3 = Path(__file__).resolve().parents[1] / "prototype" / "v3"
if str(_V3) not in sys.path:
    sys.path.insert(0, str(_V3))

from person_count_probe import probe_person_count  # type: ignore[import-not-found]

TWO_PERSON = os.environ.get(
    "CLIPPER_TWO_PERSON_FIXTURE",
    "/workspace/clipper-guide/media/two_person_720p.mp4",
)

pytestmark = pytest.mark.skipif(
    not Path(TWO_PERSON).is_file(),
    reason="two_person_720p fixture missing",
)


def test_two_person_fixture_counts_two_faces():
    raw = probe_person_count(TWO_PERSON)
    assert raw["n_persons"] == 2
    assert raw["confidence"] > 0.45
