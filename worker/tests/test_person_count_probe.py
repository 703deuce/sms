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

def test_two_person_fixture_counts_two_faces():
    if not Path(TWO_PERSON).is_file():
        pytest.skip("two_person_720p fixture missing")
    raw = probe_person_count(TWO_PERSON)
    assert raw["n_persons"] == 2
    assert raw["confidence"] > 0.45


def test_probe_prefers_reframe_core_when_v2_ops_enabled(monkeypatch):
    monkeypatch.setenv("REFRAME_V2_ENABLED", "1")
    monkeypatch.setattr(
        "person_count_probe._probe_via_reframe_core",
        lambda _p: {"n_persons": 3, "confidence": 0.88, "mean_embed_coverage": 0.7, "probe": "reframe_core"},
    )
    raw = probe_person_count("/nonexistent.mp4")
    assert raw["probe"] == "reframe_core" and raw["n_persons"] == 3
