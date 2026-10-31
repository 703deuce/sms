"""E6: punch zoom must stay centred (crop iw/ih are stale under scale eval=frame)."""
from __future__ import annotations

import shutil
import subprocess
import sys
import types
from pathlib import Path

import numpy as np
import pytest

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg missing")

W, H = 720, 1280


def _probe(p):
    o = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)],
        text=True,
    ).strip().split(",")
    return int(o[0]), int(o[1])


@pytest.fixture()
def zr(monkeypatch):
    stub = types.ModuleType("clips_worker.edits_render")
    stub.probe_video_size = _probe
    monkeypatch.setitem(sys.modules, "clips_worker.edits_render", stub)
    from clips_worker import zoom_render

    return zoom_render


def _frame(p: Path, t: float, h: int = H) -> np.ndarray:
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(p), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    )
    return np.frombuffer(raw, np.uint8).reshape(h, W)


def _src(tmp: Path, box_y: int) -> Path:
    src = tmp / "src.mp4"
    subprocess.check_call(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
         f"color=black:s={W}x{H}:d=3:r=30,drawbox=x=340:y={box_y}:w=40:h=80:color=white:t=fill",
         "-pix_fmt", "yuv420p", str(src)]
    )
    return src


KF = [(0.0, 1.0), (0.5, 1.0), (0.75, 1.15), (2.5, 1.15), (3.0, 1.0)]


def test_full_frame_zoom_stays_centred(zr, tmp_path):
    src = _src(tmp_path, 600)  # box centred at (360, 640)
    out = tmp_path / "out.mp4"
    zr.apply_zoom(src, out, KF, 3.0, W, H)
    for t in (0.2, 1.0, 1.5, 2.2):
        ys, xs = np.where(_frame(out, t) > 200)
        assert abs(xs.mean() - 359.5) <= 1.5, (t, xs.mean())
        assert abs(ys.mean() - 639.5) <= 1.5, (t, ys.mean())
    ys, xs = np.where(_frame(out, 1.5) > 200)
    assert xs.max() - xs.min() + 1 >= 45  # actually zoomed (40 * 1.15)


def test_facecam_band_zoom_stays_centred_in_band(zr, tmp_path):
    band = 448  # centre of band = 224
    src = _src(tmp_path, 184)  # box centred at (360, 224)
    out = tmp_path / "out.mp4"
    zr.apply_zoom(src, out, KF, 3.0, W, H, facecam_only=True, facecam_band_h=band)
    ys, xs = np.where(_frame(out, 1.5) > 200)
    assert abs(xs.mean() - 359.5) <= 1.5
    assert abs(ys.mean() - 223.5) <= 1.5
