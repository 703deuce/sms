"""E3 parity: motion.py vs the web math (fixture written by new-app/tests/motion-parity.test.ts),
and the ffmpeg expressions motion.py emits vs the same math (evaluated by ffmpeg itself)."""
from __future__ import annotations

import array
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.motion import (
    broll_transition_windows,
    cut_transition_windows,
    layer_transform_at,
    normalize_keyframes,
    track_expr,
    track_value_at,
    transition_frame,
    volume_at,
    volume_expr,
)

FIX = json.loads((Path(__file__).parent / "fixtures" / "motion_parity.json").read_text())


def _close(a, b, tol=1e-9):
    if isinstance(a, dict):
        assert set(a) == set(b), (a, b)
        for k in a:
            _close(a[k], b[k], tol)
    elif isinstance(a, list):
        assert len(a) == len(b), (a, b)
        for x, y in zip(a, b):
            _close(x, y, tol)
    elif isinstance(a, (int, float)) and not isinstance(a, bool) and a is not None and b is not None:
        assert abs(a - b) <= tol, (a, b)
    else:
        assert a == b, (a, b)


def test_normalize_keeps_tracks():
    assert normalize_keyframes(FIX["tracks"]) == FIX["tracks"]


def test_keyframe_values_match_web():
    for row in FIX["keyframes"]:
        tr = next(t for t in FIX["tracks"] if t["target"] == row["target"] and t["prop"] == row["prop"])
        got = [track_value_at(tr, row["prop"], ms) for ms in FIX["sampleMs"]]
        _close(got, row["values"])
    edits = {"keyframes": FIX["tracks"]}
    _close([layer_transform_at(edits, "video", ms) for ms in FIX["sampleMs"]], FIX["layer"])
    _close([volume_at(edits, "music", ms) for ms in FIX["sampleMs"]], FIX["volume"])


def test_transition_frames_match_web():
    for ttype, frames in FIX["frames"].items():
        _close([transition_frame(ttype, q) for q in FIX["qs"]], frames)


def test_cut_windows_match_web():
    for c in FIX["cutCases"]:
        _close(cut_transition_windows([tuple(s) for s in c["segs"]], c["transitions"]), c["expected"])


def test_broll_windows_match_web():
    _close(broll_transition_windows(FIX["broll"]["items"]), FIX["broll"]["expected"])


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_ffmpeg_expressions_evaluate_to_the_math():
    """Each track's expression, evaluated by ffmpeg (aevalsrc, t = sample time), equals the math."""
    rate = 1000
    for tr in FIX["tracks"]:
        expr = track_expr(tr, tr["prop"], var="t", origin_s=0.25)
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc=exprs='{expr}':s={rate}:d=5",
             "-f", "f64le", "-c:a", "pcm_f64le", "-"], capture_output=True, check=True).stdout
        vals = array.array("d", raw)
        assert len(vals) >= 4900
        for i in range(0, len(vals), 7):
            local_ms = i * 1000 / rate - 250
            exp = track_value_at(tr, tr["prop"], local_ms)
            assert abs(vals[i] - exp) < 1e-6, (tr["target"], tr["prop"], local_ms, vals[i], exp)


def test_volume_expr_none_at_unity():
    assert volume_expr({"keyframes": []}, "voice") is None
    assert volume_expr({"keyframes": [{"target": "voice", "prop": "volume", "points": [{"tMs": 0, "v": 50}]}]}, "voice") == "(50)/100"


def test_music_envelope_in_filter():
    from clips_worker.audio_render import build_audio_filter, music_chain

    env = volume_expr({"keyframes": [{"target": "music", "prop": "volume",
                                      "points": [{"tMs": 0, "v": 100}, {"tMs": 1000, "v": 0}]}]}, "music", origin_s=2.0)
    chain = music_chain(1, 10.0, 0.25, 0.5, 1.0, {"startMs": 2000, "endMs": 6000, "inMs": 0}, "mv", env)
    # Envelope after adelay/apad → evaluated on OUTPUT time with the window origin (2 s).
    assert chain.endswith(f",volume='{env}':eval=frame[mv]")
    assert "(t-2)" in env
    fc, _ = build_audio_filter(length_s=10, volume=0.25, duck_depth=0.5, fade_in_s=0.5, fade_out_s=1,
                               has_music=True, sfx_specs=[], music_volume_expr=env)
    assert f"volume='{env}':eval=frame" in fc
    legacy, _ = build_audio_filter(length_s=10, volume=0.25, duck_depth=0.5, fade_in_s=0.5, fade_out_s=1,
                                   has_music=True, sfx_specs=[])
    assert "eval=frame" not in legacy
