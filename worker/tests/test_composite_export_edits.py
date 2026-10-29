"""Composite preview export applies trim/cut segments on clip timeline."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from clips_worker.edits_render import default_edits, normalize_edits, output_duration_ms
from clips_worker.render_job import _concat_accurate, apply_composite_edits


def _make_test_mp4(path: Path, duration_s: float = 3.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size=320x180:rate=30:duration={duration_s:.2f}",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:duration={duration_s:.2f}",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            str(path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out or "0")


def test_concat_accurate_single_segment(tmp_path: Path) -> None:
    src = tmp_path / "src.mp4"
    dest = tmp_path / "dest.mp4"
    _make_test_mp4(src, 2.0)
    _concat_accurate(src, dest, [(0.25, 1.75)])
    dur = _probe_duration(dest)
    assert 1.4 <= dur <= 1.6


def test_apply_composite_edits_cut_range(tmp_path: Path) -> None:
    clip_start = 10_000
    clip_end = 13_000
    clip_file = tmp_path / "clip.mp4"
    _make_test_mp4(clip_file, 3.0)
    edits = normalize_edits(default_edits(clip_start, clip_end), clip_start, clip_end)
    edits["cutRanges"] = [[11_000, 12_000]]
    edited = apply_composite_edits(
        clip_file,
        tmp_path,
        edits,
        cut_start=clip_start,
        clip_start=clip_start,
        clip_end=clip_end,
        render_id="test-render",
    )
    assert edited.is_file()
    expected_ms = output_duration_ms(edits)
    actual_ms = int(_probe_duration(edited) * 1000)
    assert abs(actual_ms - expected_ms) < 250
