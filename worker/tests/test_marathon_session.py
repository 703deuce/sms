from datetime import datetime, timezone

from clips_worker.streamer.marathon_session import should_merge_stream_segments


def test_merge_within_ten_minutes():
    end = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)
    start = datetime(2026, 10, 27, 12, 5, 0, tzinfo=timezone.utc)
    assert should_merge_stream_segments(end, start) is True


def test_no_merge_after_ten_minutes():
    end = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)
    start = datetime(2026, 10, 27, 12, 11, 0, tzinfo=timezone.utc)
    assert should_merge_stream_segments(end, start) is False
