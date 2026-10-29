"""Regression: explicit Twitch VOD + trim range must not use growing-archive live path."""

from __future__ import annotations

import pytest

from clips_worker.streamer import import_job
from clips_worker.streamer.twitch_archive_resolve import guard_twitch_growing_archive_url
from clips_worker.streamer.ytdlp import metadata


def test_allow_growing_false_for_finished_vod_with_trim_range():
    vod = {
        "platform": "twitch",
        "sourceType": "vod",
        "rangeStartMs": 32 * 60_000 + 30_000,
        "rangeEndMs": 34 * 60_000 + 30_000,
        "state": {},
    }
    assert import_job._allow_twitch_growing_vod(vod) is False


def test_allow_growing_true_for_live_capture():
    vod = {
        "platform": "twitch",
        "rangeStartMs": 0,
        "rangeEndMs": 300_000,
        "state": {"liveCapture": True, "processMode": "rolling"},
    }
    assert import_job._allow_twitch_growing_vod(vod) is True


def test_guard_skipped_when_not_allow_growing():
    vod = {"platform": "twitch", "rangeStartMs": 1000, "rangeEndMs": 2000, "state": {}}
    guard_twitch_growing_archive_url(
        vod,
        "https://www.twitch.tv/videos/2913609480",
        allow_growing=False,
    )


def test_metadata_was_live_finished_vod_without_growing_flag(monkeypatch):
    payload = {
        "is_live": False,
        "live_status": "was_live",
        "duration": 7522.0,
        "title": "test",
    }

    def fake_run(*args, **kwargs):
        class R:
            returncode = 0
            stdout = __import__("json").dumps(payload)
            stderr = ""

        return R()

    monkeypatch.setattr("subprocess.run", fake_run)
    meta = metadata("https://www.twitch.tv/videos/2913609480", allow_twitch_growing_vod=False)
    assert meta.get("live_status") == "was_live"
    assert float(meta.get("duration") or 0) > 60


def test_metadata_was_live_short_duration_raises_when_growing_allowed(monkeypatch):
    payload = {"is_live": False, "live_status": "was_live", "duration": 10.0}

    def fake_run(*args, **kwargs):
        class R:
            returncode = 0
            stdout = __import__("json").dumps(payload)
            stderr = ""

        return R()

    monkeypatch.setattr("subprocess.run", fake_run)
    with pytest.raises(RuntimeError, match="saved broadcast"):
        metadata("https://www.twitch.tv/videos/1", allow_twitch_growing_vod=True)


def test_guard_explicit_archive_vod_id_published(monkeypatch):
    vod = {
        "platform": "twitch",
        "channelLogin": "testchannel",
        "state": {},
    }
    url = "https://www.twitch.tv/videos/2913609480"

    def fake_helix(path: str):
        if path.startswith("/users?"):
            return {"data": [{"id": "1"}]}
        if path.startswith("/streams?"):
            return {"data": [{"id": "999", "started_at": "2026-01-01T00:00:00Z"}]}
        if path.startswith("/videos?id="):
            return {"data": [{"id": "2913609480", "duration": "2h5m22s"}]}
        if path.startswith("/videos?user_id"):
            return {"data": []}
        return {}

    monkeypatch.setattr(
        "clips_worker.streamer.twitch_archive_resolve._helix_json",
        fake_helix,
    )
    guard_twitch_growing_archive_url(vod, url, allow_growing=True)
