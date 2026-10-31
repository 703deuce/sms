"""FV2: full-video editor assets — peaks, filmstrip sprite, 720p proxy (real ffmpeg, < 15 s)."""
from __future__ import annotations

import base64
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker import full_video_assets as fva

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg required")


def _make_src(path: Path, seconds: int, size: str = "1280x720") -> Path:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size={size}:rate=25:duration={seconds}",
         "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}",
         "-af", "volume='if(lt(t,2),0,1)':eval=frame",
         "-c:v", "libx264", "-preset", "ultrafast", "-g", "25", "-c:a", "aac", "-shortest", str(path)],
        check=True, capture_output=True, timeout=60,
    )
    return path


def test_interval_and_tile_math() -> None:
    assert fva.filmstrip_interval_s(25_000) == 1
    assert fva.filmstrip_interval_s(30 * 60_000) == 3
    assert fva.filmstrip_interval_s(60 * 60_000) == 10  # 360 thumbs for an hour
    assert fva.filmstrip_interval_s(3 * 60 * 60_000) == 20  # 540 thumbs for 3 h
    assert fva.filmstrip_tile_w(1920, 1080) == 160
    assert fva.filmstrip_tile_w(1080, 1920) == 50
    assert fva.filmstrip_tile_w(0, 0) == 160


def test_peaks_compact_and_time_indexed(tmp_path: Path) -> None:
    src = _make_src(tmp_path / "s.mp4", 6)
    p = fva.compute_peaks(src, 6000)
    assert p["v"] == 1 and p["peaksPerSec"] == 20 and p["format"] == "u8b64"
    data = base64.b64decode(p["data"])
    assert 118 <= len(data) <= 122  # 6 s x 20/s
    assert max(data) == 255
    assert max(data[:30]) < 20  # first 1.5 s silent
    assert min(data[60:110]) > 100  # tone after 2 s
    assert len(json.dumps(p)) < 1000


def test_filmstrip_sheet_layout(tmp_path: Path) -> None:
    src = _make_src(tmp_path / "s.mp4", 25)
    fs = fva.build_filmstrip(src, tmp_path / "fs", 25_000, 1280, 720)
    assert fs is not None
    assert fs["intervalMs"] == 1000 and fs["tileW"] == 160 and fs["tileH"] == 90
    assert fs["cols"] == 10 and fs["rows"] == 10 and fs["count"] == 25
    assert len(fs["files"]) == 1
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", fs["files"][0]], text=True
    ).strip()
    assert out == "1600,900"
    assert Path(fs["files"][0]).stat().st_size < 400_000


def test_proxy_720_and_skip_rule(tmp_path: Path) -> None:
    src = _make_src(tmp_path / "s.mp4", 3, "1920x1080")
    out = tmp_path / "proxy.mp4"
    assert fva.build_proxy(src, out, 3000, 2)
    info = fva.probe_stream(out)
    assert info["height"] == 720 and info["width"] == 1280 and info["codec"] == "h264"
    assert fva.proxy_needed({"width": 1920, "height": 1080, "codec": "h264", "bitRate": 8_000_000})
    assert not fva.proxy_needed({"width": 1280, "height": 720, "codec": "h264", "bitRate": 1_500_000})
    assert fva.proxy_needed({"width": 1280, "height": 720, "codec": "hevc", "bitRate": 1_500_000})


def test_pre_ready_assets_upload_keys(tmp_path: Path) -> None:
    src = _make_src(tmp_path / "s.mp4", 4)
    uploaded: list[str] = []
    meta = fva.build_pre_ready_assets(src, "ws1", "proj1", 4000, 1280, 720, lambda k, p, ct: uploaded.append(k))
    assert meta["peaksKey"] == "ws/ws1/projects/proj1/editor/peaks.json"
    assert meta["filmstrip"]["keys"] == ["ws/ws1/projects/proj1/editor/filmstrip_001.jpg"]
    assert "files" not in meta["filmstrip"]
    assert uploaded == ["ws/ws1/projects/proj1/editor/peaks.json", "ws/ws1/projects/proj1/editor/filmstrip_001.jpg"]


def test_fvfix_peaks_rate_budget_and_full_coverage(tmp_path):
    assert fva.peaks_rate_for(715_740) == 100
    assert fva.peaks_rate_for(3_600_000) == 100
    assert fva.peaks_rate_for(7_200_000) == 50
    assert fva.peaks_rate_for(10_800_000) == 25
    for d in (60_000, 715_740, 3_600_000, 10_800_000):
        assert fva.peaks_rate_for(d) * d / 1000 <= fva.PEAKS_MAX_SAMPLES
    # every second of audio is covered (no truncated tail): 6 s tone at 100/s -> ~600 values,
    # and the last half second is not silent.
    import base64
    import subprocess

    src = tmp_path / "tone.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
         "-c:a", "aac", str(src)],
        check=True,
    )
    p = fva.compute_peaks(src, 6000, 100)
    data = base64.b64decode(p["data"])
    assert p["peaksPerSec"] == 100
    assert 595 <= len(data) <= 610
    assert min(data[-60:-10]) > 50
