"""KF-15: custom bezier easing parity with motion-schema / keyframes.ts."""
from __future__ import annotations

import array
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.motion import (
    EASE_BZ,
    EASES,
    ease_value,
    normalize_bz,
    normalize_keyframes,
    point_ease,
    track_expr,
    track_value_at,
)

FIX = json.loads((Path(__file__).parent / "fixtures" / "motion_parity.json").read_text())


def test_point_ease_presets():
    for e in EASES:
        a, b = EASE_BZ[e]
        for u in (0, 0.1, 0.25, 0.5, 0.9, 1):
            assert abs(point_ease({"bz": [a, b]}, u) - ease_value(e, u)) < 1e-12


def test_normalize_bz():
    assert normalize_bz([0, 1]) == {"ease": "inOut"}
    assert normalize_bz([1 / 3, 2 / 3]) == {}
    assert normalize_bz([1.4, -2]) == {"bz": [1, 0]}
    assert normalize_bz("x") is None
    assert normalize_bz([0.234, 0.5]) == {"bz": [0.23, 0.5]}
    assert normalize_bz([0.235, 0.5]) == {"bz": [0.24, 0.5]}


def test_normalize_keyframes_bz():
    raw = [{"target": "video", "prop": "x", "points": [{"tMs": 0, "v": 0, "ease": "in", "bz": [0.5, 0.5]}]}]
    out = normalize_keyframes(raw)
    assert out[0]["points"][0]["bz"] == [0.5, 0.5]
    assert "ease" not in out[0]["points"][0]


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_track_expr_bz_matches_value_at():
    tr = next(t for t in FIX["tracks"] if t.get("prop") == "y" and t.get("target") == "video")
    expr = track_expr(tr, "y", var="t", origin_s=0.0)
    rate = 1000
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc=exprs='{expr}':s={rate}:d=5",
         "-f", "f64le", "-c:a", "pcm_f64le", "-"], capture_output=True, check=True).stdout
    vals = array.array("d", raw)
    for i in range(0, min(len(vals), 5000), 7):
        local_ms = i * 1000 / rate
        exp = track_value_at(tr, "y", local_ms)
        assert abs(vals[i] - exp) < 1e-6, (local_ms, vals[i], exp)
