"""ffmpeg filtergraph smoke tests (lavfi, ≤5s). Verifies review §4 aspect-correct crops + setsar=1."""
from __future__ import annotations

import shutil
import subprocess

import pytest

from clips_worker import reframe_core as rc

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def _run_graph(fc: str, out_w: int = 720, out_h: int = 1280, src_size: str = "1280x720", duration: str = "2") -> None:
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"testsrc2=size={src_size}:rate=30:duration={duration}",
        "-filter_complex",
        fc,
        "-map",
        "[v]",
        "-frames:v",
        "30",
        "-f",
        "null",
        "-",
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def test_segment_close_setsar_square():
    fc = rc.segment_filter("single", [(100, 0, 405, 720)], 720, 1280)
    assert "setsar=1" in fc
    _run_graph(fc.removesuffix("[v]") + "[v]")


def test_segment_split_vstack():
    crops = [(100, 0, 405, 720), (500, 0, 405, 720)]
    fc = rc.segment_filter("split", crops, 720, 1280)
    _run_graph(fc)


def test_segment_grid_xstack():
    crops = [(i * 200, 0, 300, 540) for i in range(4)]
    fc = rc.segment_filter("grid", crops, 1080, 1920)
    _run_graph(fc, out_w=1080, out_h=1920, src_size="1920x1080")


def test_segment_wide_blur_fit():
    fc = rc.segment_filter("wide", [], 720, 1280)
    _run_graph(fc)


def test_segment_three_up_vstack():
    crops = [(100, 0, 405, 720), (400, 0, 405, 720), (700, 0, 405, 720)]
    fc = rc.segment_filter("three", crops, 720, 1280)
    assert fc.count("vstack=inputs=3") == 1
    _run_graph(fc)
