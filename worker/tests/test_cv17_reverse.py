"""CV-17b main video reverse export."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.edits_render import default_edits, is_default_edits
from clips_worker.video_reverse import drop_reversed_words, normalize_video_reverse, reverse_pieces_ms

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def test_normalize_video_reverse():
    assert normalize_video_reverse([{"startMs": 0, "endMs": 50}]) == []
    assert normalize_video_reverse([{"startMs": 0, "endMs": 70_000}]) == []
    out = normalize_video_reverse([{"startMs": 1000, "endMs": 4000}, {"startMs": 3500, "endMs": 6000}])
    assert out == [{"startMs": 1000, "endMs": 4000}, {"startMs": 4000, "endMs": 6000}]


def test_reverse_pieces_intersect():
    d = default_edits(0, 30_000)
    d["trim"] = {"in": 2000, "out": 12000}
    d["videoReverse"] = [{"startMs": 0, "endMs": 20_000}]
    assert reverse_pieces_ms(d) == [(2000, 12000)]
    d["cutRanges"] = [[5000, 6000]]
    d["videoReverse"] = [{"startMs": 2000, "endMs": 10_000}]
    assert reverse_pieces_ms(d) == [(2000, 5000), (6000, 10_000)]


def test_is_default_false_with_video_reverse():
    d = default_edits(0, 10_000)
    assert is_default_edits(d, 0, 10_000)
    assert not is_default_edits({**d, "videoReverse": [{"startMs": 0, "endMs": 2000}]}, 0, 10_000)


def test_drop_reversed_words():
    d = default_edits(0, 10_000)
    d["videoReverse"] = [{"startMs": 1000, "endMs": 3000}]
    words = [{"w": "a", "s": 0.5, "e": 0.7, "i": 0}, {"w": "b", "s": 1.5, "e": 1.7, "i": 1}]
    kept = drop_reversed_words(words, d)
    assert len(kept) == 1
    assert kept[0]["w"] == "a"


@ff
def test_apply_reverse_real(tmp_path):
    from clips_worker.video_reverse import apply_full_render_reverse

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
            "testsrc2=size=160x96:rate=30:duration=3",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=3",
            "-shortest",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            str(src),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    edits = default_edits(0, 3000)
    edits["videoReverse"] = [{"startMs": 1000, "endMs": 2000}]
    out = apply_full_render_reverse(src, edits, 0, 3000, tmp_path)
    assert out.exists()
    dur = float(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nokey=1", str(out)]
        )
        .decode()
        .strip()
    )
    assert abs(dur - 3.0) < 0.05
    ar = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(out)],
        capture_output=True,
        text=True,
    )
    assert ar.returncode == 0 and "audio" in ar.stdout
