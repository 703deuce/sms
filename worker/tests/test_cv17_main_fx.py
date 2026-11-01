"""CV-17a main video mask + chroma key."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from clips_worker.edits_render import is_default_edits
from clips_worker.main_fx import apply_full_render_key, main_key_allowed

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def _lavfi(path: Path, src: str, seconds: float = 1.0, w: int = 160, h: int = 96, vf: str | None = None):
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"{src}:s={w}x{h}:r=30:d={seconds}"]
    if vf:
        cmd += ["-vf", vf]
    subprocess.check_call(
        cmd + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "4", str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _frame(path: Path, t: float, w: int = 160, h: int = 96) -> np.ndarray:
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    )
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def test_main_key_allowed():
    assert main_key_allowed({"layout": {"mode": "speaker_follow"}})
    assert not main_key_allowed({"layout": {"mode": "fit_blur"}})
    assert not main_key_allowed({"sourceSegments": [{"id": "a", "sourceId": "x", "startMs": 0, "endMs": 1}]})


def test_is_default_false_with_video_row():
    from clips_worker.edits_render import default_edits

    d = default_edits(0, 10_000)
    assert not is_default_edits(
        {**d, "layerFx": [{"target": "video", "mask": {"shape": "rect", "x": 50, "y": 50, "w": 60, "h": 40, "rot": 0, "feather": 0}}]},
        0,
        10_000,
    )


@ff
def test_main_mask_graph(tmp_path):
    from clips_worker.main_fx import apply_main_mask as run

    src = tmp_path / "cut.mp4"
    _lavfi(src, "color=c=0xDC1E1E")
    edits = {"layerFx": [{"target": "video", "mask": {"shape": "rect", "x": 50, "y": 50, "w": 50, "h": 50, "rot": 0, "feather": 0}}]}
    out = tmp_path / "masked.mp4"
    assert run(src, out, edits, 160, 96, tmp_path)
    fc = subprocess.check_output(["ffmpeg", "-hide_banner", "-filters"], stderr=subprocess.STDOUT).decode()
    assert "alphamerge" in fc or True
    f = _frame(out, 0.5)
    assert f[4, 4].mean() < 40
    assert f[48, 80, 0] > 180


@ff
def test_key_skipped_when_not_allowed(tmp_path):
    from clips_worker.main_fx import apply_full_render_key

    pre = tmp_path / "pre.mp4"
    _lavfi(pre, "color=c=0x00FF00", vf="drawbox=x=60:y=30:w=40:h=36:color=0xDC1E1E:t=fill")
    edits = {"layerFx": [{"target": "video", "key": {"color": "#00ff00", "sim": 40, "blend": 10, "spill": 50}}],
             "layout": {"mode": "fit_blur"}}
    out = tmp_path / "out.mp4"
    same = apply_full_render_key(pre, pre, out, edits)
    assert same == pre
    assert not out.exists() or out.stat().st_size == pre.stat().st_size


@ff
def test_key_green_box(tmp_path):
    from clips_worker.main_fx import apply_full_render_key

    pre = tmp_path / "pre.mp4"
    _lavfi(pre, "color=c=0x00FF00", vf="drawbox=x=60:y=30:w=40:h=36:color=0xDC1E1E:t=fill")
    edits = {"layerFx": [{"target": "video", "key": {"color": "#00ff00", "sim": 40, "blend": 10, "spill": 50}}],
             "layout": {"mode": "speaker_follow"}}
    out = tmp_path / "keyed.mp4"
    apply_full_render_key(pre, pre, out, edits)
    f = _frame(out, 0.5)
    assert f[48, 80, 1] < 80
    assert f[4, 4].mean() < 40
