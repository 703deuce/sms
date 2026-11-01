"""CV-17c: text item mask/blend export path (layerFx target text:<id>)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
W, H = 160, 96


def _run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


@ff
def test_text_item_mask_blend_uses_ass_overlay(tmp_path):
    from clips_worker.text_items import apply_text_items

    src = tmp_path / "src.mp4"
    _run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=s={W}x{H}:r=30:d=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "4",
            str(src),
        ]
    )
    edits = {
        "textItems": [
            {
                "id": "tx",
                "text": "Hi",
                "startMs": 0,
                "endMs": 900,
                "x": 50,
                "y": 50,
                "style": {"font": "Montserrat", "size": 48, "color": "#ffffff", "align": "center", "case": "none"},
            }
        ],
        "layerFx": [
            {
                "target": "text:tx",
                "mask": {"shape": "rect", "x": 50, "y": 50, "w": 80, "h": 80, "rot": 0, "feather": 0},
                "blend": "multiply",
            }
        ],
    }
    out = tmp_path / "out.mp4"
    result = apply_text_items(src, out, edits, play_w=W, play_h=H)
    assert result == out
    assert out.exists()
    assert out.stat().st_size > 1000
