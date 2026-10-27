from datetime import datetime, timezone

from clips_worker.streamer.kick_videos import match_kick_vod_from_entries, normalize_kick_video_entry


def test_normalize_kick_video_entry():
    ent = {
        "session_title": "Test stream",
        "start_time": "2026-10-26 20:59:32",
        "duration": 3_600_000,
        "video": {"uuid": "4aeefefc-cd67-413e-8107-14327b21f5a3"},
    }
    row = normalize_kick_video_entry(ent, "xqc")
    assert row is not None
    assert row["id"] == "4aeefefc-cd67-413e-8107-14327b21f5a3"
    assert row["url"] == "https://kick.com/xqc/videos/4aeefefc-cd67-413e-8107-14327b21f5a3"
    assert row["duration_s"] == 3600.0


def test_match_kick_vod_by_start_time():
    streamed_at = datetime(2026, 10, 26, 20, 59, 32, tzinfo=timezone.utc)
    ent = {
        "session_title": "Test stream",
        "start_time": "2026-10-26 20:59:32",
        "duration": 3_600_000,
        "video": {"uuid": "abc-uuid"},
    }
    matched = match_kick_vod_from_entries([ent], "slug", streamed_at)
    assert matched is not None
    assert matched["id"] == "abc-uuid"
