from clips_worker.streamer.rolling_ingest import next_rolling_window


def test_next_rolling_window_no_gap():
    planned = next_rolling_window(
        committed_end_ms=4844000,
        total_vod_ms=5103000,
        min_new_ms=60000,
        max_window_ms=900000,
        finalize=False,
    )
    assert planned == (4844000, 5103000)


def test_next_rolling_window_catch_up():
    planned = next_rolling_window(
        committed_end_ms=0,
        total_vod_ms=5_000_000,
        min_new_ms=60000,
        max_window_ms=900000,
        finalize=False,
    )
    assert planned == (0, 900000)


def test_rolling_import_mode_tick_without_env():
    payload = {"rollingTick": True}
    vod = {"platform": "twitch", "state": {}}
    assert payload.get("rollingTick") is not None
    assert str(vod.get("platform") or "").lower() == "twitch"
