"""TR batch 1 worker tests: new transitions, xfade filter strings, crossTrack fixture."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from clips_worker.motion import (
    CUT_ONLY_TRANSITIONS,
    MASK_TRANSITIONS,
    layer_transform_at,
    layer_z,
    transition_frame,
)
from clips_worker.motion_render import xfade_window_filters

FIX = json.loads((Path(__file__).parent / "fixtures" / "motion_parity.json").read_text())


def test_mask_transitions_explicit_23():
    assert len(MASK_TRANSITIONS) == 23
    assert MASK_TRANSITIONS.isdisjoint(CUT_ONLY_TRANSITIONS)


def test_transition_frame_new_types_match_fixture():
    qs = FIX["qs"]
    for ttype in (
        "pixelize", "fade_grays", "squeeze_h", "squeeze_v",
        "cover_left", "cover_right", "cover_up", "cover_down",
        "reveal_left", "reveal_right", "reveal_up", "reveal_down",
    ):
        frames = FIX["frames"][ttype]
        for q, exp in zip(qs, frames):
            got = transition_frame(ttype, q)
            assert got == exp, (ttype, q, got, exp)


def test_xfade_window_filter_strings():
    win = {"type": "fade_grays", "frames": 30, "startFrame": 0}
    fg = xfade_window_filters(win, 1, 2, 1920, 1080, "t0")
    assert "out_color_matrix=bt709" in fg
    assert "transition=fadegrays" in fg
    win_c = {"type": "cover_left", "frames": 30, "startFrame": 0}
    cl = xfade_window_filters(win_c, 1, 2, 1920, 1080, "t1")
    assert "overlay=x=" in cl
    f = transition_frame("cover_left", 0.25)
    assert f["b"]["tx"] == pytest.approx(0.75)
    win_p = {"type": "pixelize", "frames": 30, "startFrame": 0}
    px = xfade_window_filters(win_p, 1, 2, 1920, 1080, "t2")
    assert "transition=pixelize" in px


def test_cross_track_fixture_opacity_and_z():
    block = FIX["crossTrack"]
    edits = block["edits"]
    top = block["topId"]
    assert layer_z(edits, f"broll:{top}") >= layer_z(edits, "broll:a")
    b = next(x for x in edits["broll"] if x["id"] == top)
    for row in block["samples"]:
        local = row["t"] - b["startMs"]
        op = layer_transform_at(edits, f"broll:{top}", local)["opacity"] / 100.0
        assert op == pytest.approx(row["opacity"], abs=1e-6)


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not on PATH")
def test_fade_grays_mid_frame_luma():
    mid = transition_frame("fade_grays", 0.5)
    assert mid["wA"] == pytest.approx(0.5)
    assert "satA" in mid
