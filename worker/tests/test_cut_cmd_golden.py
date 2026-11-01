"""Golden: build_cut_transition_cmd must stay byte-identical for existing types."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.motion import TRANSITION_TYPES, cut_transition_windows
from clips_worker.motion_render import build_cut_transition_cmd

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "cut_cmd_golden.json"
SEGS = [(0, 5000), (5000, 10000), (10000, 15000)]


@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text()), ids=lambda c: c["type"])
def test_build_cut_transition_cmd_golden(case: dict) -> None:
    if case["type"] == "multi":
        trs = [
            {"srcMs": 5000, "type": "crossfade", "durationMs": 400},
            {"srcMs": 10000, "type": "wipe_left", "durationMs": 500},
        ]
    else:
        trs = [{"srcMs": 5000, "type": case["type"], "durationMs": 400}]
        if case["type"] in ("zoom_in", "zoom_out"):
            trs.append({"srcMs": 10000, "type": case["type"], "durationMs": 600})
    wins = cut_transition_windows(SEGS, trs)
    assert len(wins) == case["windows"], case["type"]
    cmd = build_cut_transition_cmd(
        Path("/tmp/cut.mp4"),
        Path("/tmp/full_render.mp4"),
        Path("/tmp/out.mp4"),
        wins,
        0,
        1920,
        1080,
        30.0,
    )
    assert cmd == case["cmd"]
