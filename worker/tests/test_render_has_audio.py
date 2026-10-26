"""Rendered preview clips must contain an audio stream."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from clips_worker.render_clip import ffmpeg_cut


def _has_audio_stream(path: Path) -> bool:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            str(path),
        ],
        text=True,
    ).strip()
    return "audio" in out


def test_ffmpeg_cut_preserves_audio():
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "src.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=2:size=320x240:rate=30",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=2",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-shortest",
                str(src),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        clip = Path(td) / "clip.mp4"
        ffmpeg_cut(src, clip, 0, 1500)
        assert clip.exists()
        assert _has_audio_stream(clip)
