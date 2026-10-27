"""Streamer env flag parity with new-app (default off)."""

from clips_worker.streamer.config import streamer_autopull_enabled, streamer_twitch_rolling_enabled


def test_autopull_off_by_default(monkeypatch):
    monkeypatch.delenv("STREAMER_AUTOPULL_ENABLED", raising=False)
    assert streamer_autopull_enabled() is False
    monkeypatch.setenv("STREAMER_AUTOPULL_ENABLED", "true")
    assert streamer_autopull_enabled() is True


def test_twitch_rolling_off_by_default(monkeypatch):
    monkeypatch.delenv("STREAMER_TWITCH_ROLLING_ENABLED", raising=False)
    assert streamer_twitch_rolling_enabled() is False
    monkeypatch.setenv("STREAMER_TWITCH_ROLLING_ENABLED", "yes")
    assert streamer_twitch_rolling_enabled() is True
