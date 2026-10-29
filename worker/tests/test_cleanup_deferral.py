from unittest.mock import MagicMock

from clips_worker.streamer.storage_cleanup import _cleanup_defer_reason


def test_cleanup_deferred_while_live():
    conn = MagicMock()
    reason = _cleanup_defer_reason(
        conn,
        "vod1",
        {"rolling": {"live": True}},
        "proj1",
    )
    assert reason == "rolling_live"


def test_import_guard_last_pulled_without_audio_key():
    """When cleanup removed audioKey but lastPulledMs remains, import must not short-circuit."""
    last_pulled = 4844000
    state = {"rolling": {"lastPulledMs": last_pulled}, "windows": {"4844000": {"audioKey": "x"}}}
    assert not state.get("audioKey")
    assert state.get("rolling", {}).get("lastPulledMs")
