"""CV-09 canvas background fill."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.edits_render import default_edits, is_default_edits
from clips_worker.filtergraph import canvas_bg, canvas_bg_changes_frames, fit_blur_overlay_filter

LEGACY = fit_blur_overlay_filter("0:v", "o", 720, 1280, "strong")


def _run(fc: str) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=1280x720:r=30:d=1",
            "-filter_complex",
            fc,
            "-map",
            "[vout]",
            "-f",
            "null",
            "-",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def test_legacy_filter_unchanged():
    assert fit_blur_overlay_filter("0:v", "o", 720, 1280, "strong") == LEGACY
    assert fit_blur_overlay_filter("0:v", "o", 720, 1280, "strong", bg=None) == LEGACY
    assert canvas_bg({"layout": {}}) is None


def test_color_and_image_graphs_run(tmp_path: Path):
    png = tmp_path / "canvas_bg.png"
    subprocess.check_call(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=300x200:d=1", "-frames:v", "1", str(png)]
    )
    for e in (
        {"canvasBg": {"type": "color", "color": "#3B82F6"}},
        {"canvasBg": {"type": "image", "imageId": "u1"}, "_canvasBgPath": str(png)},
    ):
        fc = fit_blur_overlay_filter("0:v", "vout", 720, 1280, None, bg=canvas_bg(e))
        _run(fc)


def test_flat_bg_blocks_preview_reuse():
    d = default_edits(0, 10_000)
    assert is_default_edits(d, 0, 10_000)
    assert not is_default_edits({**d, "canvasBg": {"type": "none"}}, 0, 10_000)
    assert canvas_bg({"canvasBg": {"type": "image", "imageId": "u1"}})["type"] == "color"
    assert canvas_bg_changes_frames({**d, "layout": {"blurStrength": "soft"}})
