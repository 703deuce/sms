"""REGRESSION_BATCH1b — export failure scope, concat, encoder parse (new file only)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.export_deliver import parse_ffmpeg_encoders_list, encoder_available
from clips_worker.streamer.job_failure import terminal_failure_progress_payload


def test_render_clip_failure_does_not_fail_project():
    payload = terminal_failure_progress_payload("RENDER_CLIP", "Export format not available: libmp3lame")
    assert payload["jobStatus"] == "FAILED"
    assert "projectStatus" not in payload
    assert "Export format" in payload.get("error", "")


def test_parse_ffmpeg_encoders_list():
    sample = """
 Encoders:
 V..... libx264              H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 A..... libmp3lame           MP3 (MPEG audio layer 3)
 ------
"""
    enc = parse_ffmpeg_encoders_list(sample)
    assert "libx264" in enc
    assert "libmp3lame" in enc


def test_encoder_available_libmp3lame_when_ffmpeg_has_it():
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    assert encoder_available("libmp3lame") is True


def _stream_duration_s(path: Path, stream: str) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            stream,
            "-show_entries",
            "stream=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    )
    return float(out.strip())


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_ffmpeg_concat_segments_two_and_three_segments(tmp_path: Path):
    from clips_worker.edits_render import ffmpeg_concat_segments

    src = tmp_path / "src.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=duration=6:size=320x180:rate=30",
            "-f",
            "lavfi",
            "-i",
            "sine=f=440:d=6",
            "-shortest",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "30",
            "-c:a",
            "aac",
            str(src),
        ],
    )
    frame_ms = 1000 / 30.0
    for n, segs in [(2, [(0.0, 1.5), (2.0, 3.5)]), (3, [(0.0, 1.0), (1.5, 2.5), (3.0, 4.0)])]:
        dest = tmp_path / f"out_{n}.mp4"
        ffmpeg_concat_segments(src, dest, segs)
        assert dest.is_file() and dest.stat().st_size > 1000
        vd = _stream_duration_s(dest, "v:0")
        ad = _stream_duration_s(dest, "a:0")
        assert abs(vd - ad) <= frame_ms / 1000 + 0.02
