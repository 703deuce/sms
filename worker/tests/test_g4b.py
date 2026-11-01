"""G4b: transitions library (xfade shape / soft / slice / corner), effects library runtime, parity fixture."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from clips_worker.xfade_masks import MASK_XFADE, b_weight, window_progress

sys.path.insert(0, str(Path(__file__).resolve().parent))
from g4b_parity_gen import FIXTURE, build  # noqa: E402

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def test_parity_fixture_is_current():
    assert json.loads(FIXTURE.read_text()) == json.loads(json.dumps(build())), "run: python3 tests/g4b_parity_gen.py"


def test_transition_types_and_names():
    from clips_worker.motion import MASK_TRANSITIONS, TRANSITION_TYPES, XFADE_NAME

    assert len(MASK_TRANSITIONS) == 23
    assert {XFADE_NAME[t] for t in MASK_TRANSITIONS} == set(MASK_XFADE)
    assert all(t in TRANSITION_TYPES for t in MASK_TRANSITIONS)


@ff
@pytest.mark.parametrize("name", MASK_XFADE)
def test_xfade_mask_model_matches_ffmpeg(tmp_path, name):
    """A = black, B = white: output gray = B weight (8-bit) at every pixel of every window frame."""
    w, h, n = 24, 16, 10
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error",
        "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:r=30:d=1",
        "-f", "lavfi", "-i", f"color=c=white:s={w}x{h}:r=30:d=1",
        "-filter_complex", f"[0:v]format=gray[a];[1:v]format=gray[b];[a][b]xfade=transition={name}:duration={n / 30}:offset=0",
        "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "gray", "-"])
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(float)
    worst = 0.0
    for k in range(1, n):
        want = b_weight(name, window_progress(k, n), w, h).astype(float) * 255
        worst = max(worst, float(np.max(np.abs(frames[k] - want))))
    assert worst <= 1.0, (name, worst)


@ff
def test_mask_transition_renders_in_broll_window(tmp_path):
    from clips_worker.broll_render import build_broll_filtergraph

    def lavfi(p, c):
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={c}:s=160x96:r=30:d=1",
                               "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "1", str(p)])

    base, b = tmp_path / "base.mp4", tmp_path / "b.mp4"
    lavfi(base, "black")
    lavfi(b, "white")
    for t in ("circle_open", "smooth_left", "slice_h_right", "wipe_tl"):
        item = {"id": "x1", "startMs": 100, "endMs": 900, "transitionIn": {"type": t, "ms": 300}}
        edits = {"broll": [item]}
        g, extra, lab = build_broll_filtergraph([{"local_path": str(b), "start_s": 0.1, "end_s": 0.9, "duration_s": 0.8,
                                                  "id": "x1", "transitionIn": item["transitionIn"]}], 160, 96, edits, tmp_path)
        out = tmp_path / f"{t}.mp4"
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(base), *extra, "-filter_complex", g, "-map",
                               f"[{lab}]", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)])
        assert out.stat().st_size > 0


@ff
def test_effects_library_runtime(tmp_path):
    """Flicker gain, scanline rows, RGB split, glitch bands and shake run in ffmpeg 5.1 as modelled."""
    from clips_worker import fx_library as fl
    from clips_worker.color_fx import fx_parts

    W, H = 192, 108
    src = tmp_path / "src.mp4"
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x808080:s={W}x{H}:r=30:d=0.5",
                           "-vf", f"drawbox=x={W // 2}:y=0:w={W // 2}:h={H}:color=white:t=fill",
                           "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "0", str(src)])

    def run(fx, frame):
        parts = fx_parts("0:v", "o", fx, W, H, tmp_path, "t")
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(src), "-filter_complex", ";".join(parts),
                                       "-map", "[o]", "-frames:v", str(frame + 1), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
        return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)[frame].astype(float)

    for f in (3, 7):
        g = fl.flicker_gain(60, f)
        out = run({"flicker": 60}, f)
        assert abs(out[H // 2, 10, 1] - 128 * g) <= 2.5, (f, out[H // 2, 10, 1], 128 * g)
    rows = fl.scanline_mask(50, W, H)[:, 0].astype(float) / 255
    out = run({"scanlines": 50}, 0)
    assert np.max(np.abs(out[:, 10, 1] - np.floor(128 * rows))) <= 2
    d = fl.rgbsplit_px(100, W, H)
    out = run({"rgbsplit": 100}, 0)
    x = W // 2
    assert out[H // 2, x - 1 + d, 0] > 200 and out[H // 2, x - 1 - d, 2] < 160  # red shifted left, blue right
    for f in (0, 3, 9, 12):
        st = fl.glitch_state(100, W, H, f)
        out = run({"glitch": 100}, f)
        for (y0, dx), b in zip(st, fl.glitch_bands(100, W, H)):
            if dx:
                row = out[y0 + b["h"] // 2, :, 1]
                edge = int(np.argmax(row > 200))
                assert abs(edge - (W // 2 + dx)) <= 1, (f, dx, edge)
    for f in (0, 2, 5):
        ox, oy = fl.shake_offset(100, W, H, f)
        sw, _ = fl.shake_size(100, W, H)
        out = run({"shake": 100}, f)
        edge = int(np.argmax(out[H // 2, :, 1] > 200))
        want = round((W // 2) * sw / W - ((sw - W) / 2 + ox))
        assert abs(edge - want) <= 2, (f, edge, want)
