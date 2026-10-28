"""Stage-2 audio-first ingest module (fixtures + optional live smoke)."""
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from clips_worker.streamer.audio_first_ingest import (
    IngestDiskQueueError,
    assert_scratch_headroom,
    ingest_clip_section_video,
    ingest_platform_label,
    stream_audio_first_ingest_enabled,
    _section_spec,
)


def test_flag_default_on():
    os.environ.pop("STREAM_AUDIO_FIRST_INGEST", None)
    assert stream_audio_first_ingest_enabled() is True
    os.environ["STREAM_AUDIO_FIRST_INGEST"] = "0"
    assert stream_audio_first_ingest_enabled() is False


def test_platform_label_no_query():
    assert ingest_platform_label("https://www.twitch.tv/videos/12345?t=token") == "twitch"
    assert ingest_platform_label("https://kick.com/foo/videos/abc") == "kick"


def test_section_spec_format():
    assert _section_spec(10.0, 40.5) == "*10.000-40.500"


def test_disk_guard_raises_when_tiny_free(tmp_path: Path):
    with patch("clips_worker.streamer.audio_first_ingest.shutil.disk_usage") as du:
        du.return_value = type("U", (), {"free": 1024, "total": 10**9, "used": 0})()
        with pytest.raises(IngestDiskQueueError):
            assert_scratch_headroom(scratch=tmp_path, min_free=10**9, need_bytes=1024)


def test_section_resume_skips_ytdlp(tmp_path: Path, monkeypatch):
    dest = tmp_path / "seg.mp4"
    dest.write_bytes(b"mp4")
    wd = tmp_path / "wd"
    wd.mkdir()
    marker = wd / ".section_render_c1.done"
    marker.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(
        "clips_worker.streamer.audio_first_ingest.assert_scratch_headroom",
        lambda **_: None,
    )

    called = {"n": 0}

    def _boom(*_a, **_k):
        called["n"] += 1

    monkeypatch.setattr("clips_worker.streamer.http_download.run_ytdlp", _boom)
    metrics = ingest_clip_section_video(
        "https://www.twitch.tv/videos/1",
        dest,
        purpose="render",
        job_id="job1",
        vod_id="vod1",
        clip_id="c1",
        start_s=0,
        end_s=5,
        work_dir=wd,
    )
    assert called["n"] == 0
    assert metrics.sections == 1


@pytest.mark.skipif(
    os.environ.get("STREAM_INGEST_LIVE_TEST") != "1",
    reason="Set STREAM_INGEST_LIVE_TEST=1 for live Twitch metadata smoke",
)
def test_live_twitch_metadata_smoke():
    import shutil
    import subprocess

    if not shutil.which("yt-dlp"):
        pytest.skip("yt-dlp not installed")
    url = "https://www.twitch.tv/videos/2149463752"
    proc = subprocess.run(
        ["yt-dlp", "-J", "--no-download", url],
        capture_output=True,
        text=True,
        timeout=90,
    )
    if proc.returncode != 0:
        pytest.skip(f"live metadata unavailable: {(proc.stderr or '')[:120]}")
    assert "duration" in proc.stdout
