"""E5b insert splice on a real ffmpeg (worker image: ffmpeg 5.1)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.media_inserts import insert_word_cues, shift_srt, splice_inserts

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


def _run(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _dur(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], text=True))


def _rgb_at(p: Path, t: float) -> tuple[int, int, int]:
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(p), "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    )
    return raw[0], raw[1], raw[2]


def _rms_at(p: Path, t: float, d: float = 0.3) -> float:
    out = subprocess.run(
        ["ffmpeg", "-v", "info", "-ss", f"{t:.3f}", "-t", f"{d:.3f}", "-i", str(p), "-vn", "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    line = next(l for l in out.splitlines() if "mean_volume" in l)
    return float(line.split("mean_volume:")[1].split("dB")[0])


@pytest.fixture()
def media(tmp_path: Path):
    main = tmp_path / "main.mp4"
    _run("-f", "lavfi", "-i", "color=c=red:s=360x640:r=30:d=4", "-f", "lavfi", "-i", "sine=f=440:d=4:sample_rate=48000",
         "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(main))
    clip = tmp_path / "clip.mp4"
    _run("-f", "lavfi", "-i", "color=c=blue:s=640x360:r=25:d=3", "-f", "lavfi", "-i", "sine=f=880:d=3:sample_rate=44100",
         "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(clip))
    still = tmp_path / "still.png"
    _run("-f", "lavfi", "-i", "color=c=green:s=200x200", "-frames:v", "1", str(still))
    return main, clip, still


def _edits(inserts):
    return {
        "trim": {"in": 0, "out": 4000},
        "sources": [
            {"id": "upl_c", "ref": "upload", "refId": "upl_c", "mediaType": "video", "durationMs": 3000},
            {"id": "upl_s", "ref": "upload", "refId": "upl_s", "mediaType": "image"},
        ],
        "inserts": inserts,
    }


def test_insert_and_append_lengthen_and_shift(media, tmp_path):
    main, clip, still = media
    edits = _edits([
        {"id": "a", "sourceId": "upl_c", "atSrcMs": 1000, "inMs": 500, "durMs": 1500},
        {"id": "e", "sourceId": "upl_s", "atSrcMs": 0, "append": True, "durMs": 1000},
    ])
    meta = {"keep_segs_src": [(0, 4000)]}
    srt = "1\n00:00:00,200 --> 00:00:00,800\nbefore\n\n2\n00:00:02,000 --> 00:00:02,500\nafter\n\n"
    words = [{"w": "hi", "startMs": 1100, "endMs": 1400, "i": 1, "insertId": "a"}]
    out, new_srt, added = splice_inserts(main, tmp_path, edits, meta, {"upl_c": clip, "upl_s": still}, srt, words)
    assert added == 2500
    assert abs(_dur(out) - 6.5) < 0.12
    r, g, b = _rgb_at(out, 0.5)
    assert r > 180 and b < 80  # main (red)
    r, g, b = _rgb_at(out, 1.7)
    assert b > 180 and r < 80  # insert (blue), letterbox-free cover
    r, g, b = _rgb_at(out, 4.0)
    assert r > 180  # main resumes at its 1 s point
    r, g, b = _rgb_at(out, 6.0)
    assert g > 100 and r < 80 and b < 80  # appended still (green)
    assert _rms_at(out, 6.0) < -60  # still is silent
    assert _rms_at(out, 1.5) > -40  # insert keeps its sound
    assert "00:00:00,200 --> 00:00:00,800\nbefore" in new_srt
    assert "00:00:03,500 --> 00:00:04,000\nafter" in new_srt
    assert "00:00:01,100 --> 00:00:01,400\nhi" in new_srt
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(out)], text=True))
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    assert (v["width"], v["height"]) == (360, 640)


def test_muted_insert_and_missing_media(media, tmp_path):
    main, clip, _still = media
    edits = _edits([{"id": "a", "sourceId": "upl_c", "atSrcMs": 2000, "inMs": 0, "durMs": 1000, "audio": "mute"}])
    out, _srt, added = splice_inserts(main, tmp_path, edits, {"keep_segs_src": [(0, 4000)]}, {"upl_c": clip}, "", [])
    assert added == 1000 and abs(_dur(out) - 5.0) < 0.12
    assert _rms_at(out, 2.3) < -60
    # Media not downloaded → export unchanged (logged), never fails.
    same, _s, zero = splice_inserts(main, tmp_path, edits, {}, {}, "x", [])
    assert same == main and zero == 0


def test_srt_helpers():
    srt = "1\n00:00:01,000 --> 00:00:03,000\nspans\n\n"
    out = shift_srt(srt, [(2000.0, 1000.0)], [(2000.0, 2500.0, "ins")])
    assert "00:00:01,000 --> 00:00:04,000\nspans" in out
    assert out.index("spans") < out.index("ins")
    cues = insert_word_cues([
        {"w": "a", "startMs": 0, "endMs": 100, "insertId": "x"},
        {"w": "b", "startMs": 100, "endMs": 200, "insertId": "x"},
        {"w": "c", "startMs": 300, "endMs": 400, "insertId": "y"},
    ])
    assert cues == [(0, 200, "a b"), (300, 400, "c")]
