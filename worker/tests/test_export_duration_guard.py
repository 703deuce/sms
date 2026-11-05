"""F15: final rendered clip duration must match the timeline, not overlay/AAC tails."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.export_duration_guard import correct_export_overrun, probe_stream_durations


@pytest.mark.skipif(not shutil.which("ffmpeg") or not shutil.which("ffprobe"), reason="ffmpeg is required")
def test_clamps_one_second_clip_with_overlong_video_and_audio(tmp_path: Path) -> None:
    source = tmp_path / "overlong.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "color=c=black:s=160x90:r=25:d=1.32",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1.216",
            "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
            str(source),
        ],
        check=True,
    )
    before = probe_stream_durations(source)
    assert before["video"] >= 1.28
    assert before["audio"] >= 1.17
    result, lengths = correct_export_overrun(source, tmp_path / "bounded.mp4", 1000)
    assert result.name == "bounded.mp4"
    assert lengths["video"] <= 1.07
    assert lengths["audio"] <= 1.07
    assert lengths["video"] >= 0.95


@pytest.mark.skipif(not shutil.which("ffmpeg") or not shutil.which("ffprobe"), reason="ffmpeg is required")
def test_does_not_reencode_when_streams_are_already_in_tolerance(tmp_path: Path) -> None:
    source = tmp_path / "exact.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "color=c=black:s=160x90:r=25:d=1",
            "-c:v", "libx264", "-preset", "ultrafast", str(source),
        ],
        check=True,
    )
    result, lengths = correct_export_overrun(source, tmp_path / "should_not_exist.mp4", 1000)
    assert result == source
    assert lengths["video"] <= 1.07
    assert not (tmp_path / "should_not_exist.mp4").exists()
