"""Smoke-proof a real MP4 exported with generated editable motion text + a shape.

Runs without external credentials or footage. Uses the same `apply_text_items`
function as the production edit renderer and verifies rendered pixels and audio.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.text_items import apply_text_items, text_items_ass


def _run(*args: str) -> None:
    subprocess.run(args, check=True, capture_output=True, text=True)


def _frame(path: Path, seconds: float) -> bytes:
    return subprocess.check_output([
        "ffmpeg", "-v", "error", "-ss", str(seconds), "-i", str(path),
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ])


@pytest.mark.skipif(not shutil.which("ffmpeg") or not shutil.which("ffprobe"),
                    reason="FFmpeg required")
@pytest.mark.parametrize('width,height', [(360, 640), (640, 360), (480, 480)])
def test_generated_text_and_shape_render_in_real_mp4(tmp_path: Path, width: int, height: int) -> None:
    src = tmp_path / "raw.mp4"
    output = tmp_path / "motion.mp4"
    _run("ffmpeg", "-y", "-v", "error",
         "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r=30:d=2.0",
         "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
         "-shortest", str(src))
    edits = {
        "v": 2,
        "keyframes": [
            {"target": "text:mg_sample", "prop": "rotation",
             "value": 0, "points": [{"tMs": 0, "v": 0}, {"tMs": 800, "v": 15}]},
        ],
        "textItems": [
            {
                "id": "mg_sample",
                "startMs": 350, "endMs": 1700,
                "text": "MOTION WORKS",
                "x": 50, "y": 42,
                "style": {"font": "Montserrat", "size": 116,
                          "color": "#FFFFFF", "align": "center",
                          "stroke": {"color": "#000000", "width": 2}},
                "anim": {"in": {"type": "slide_up", "unit": "block", "durMs": 300},
                         "out": {"type": "fade", "unit": "block", "durMs": 200}},
            },
            {
                "id": "mg_chart__bar_0",
                "startMs": 350, "endMs": 1700,
                "text": "", "kind": "shape",
                "shape": {"type": "rounded", "w": 130, "h": 180},
                "x": 50, "y": 65,
                "style": {"font": "Montserrat", "size": 32,
                          "color": "#34D399", "align": "center", "case": "none"},
                "anim": {"in": {"type": "zoom", "unit": "block", "durMs": 250}},
            },
        ],
    }
    assert text_items_ass(edits, w=width, h=height)
    rendered = apply_text_items(src, output, edits, play_w=width, play_h=height)
    assert rendered == output and output.is_file()
    assert output.stat().st_size > 10_000
    # Compare actual decoded images, not planned overlay metadata.
    base_mid, rendered_mid = _frame(src, 1.0), _frame(output, 1.0)
    assert len(base_mid) == len(rendered_mid) == width * height * 3
    changed = sum(a != b for a, b in zip(base_mid, rendered_mid))
    assert changed > 900, "Text/shape did not appear in the real MP4"
    # No graphic is scheduled at the beginning or end of the composition.
    base_start, output_start = _frame(src, 0.1), _frame(output, 0.1)
    start_changed = sum(a != b for a, b in zip(base_start, output_start))
    assert start_changed < changed / 3
    info = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a",
        "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1", str(output),
    ], text=True)
    assert "aac" in info
