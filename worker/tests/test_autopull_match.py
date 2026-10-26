from datetime import datetime, timezone

from clips_worker.streamer.autopull_job import _match_kick_vod


def test_kick_match_empty_without_ytdlp(monkeypatch):
    monkeypatch.setattr(
        "clips_worker.streamer.autopull_job.subprocess.check_output",
        lambda *a, **k: b'{"entries":[]}',
    )
    assert _match_kick_vod("slug", datetime.now(timezone.utc)) is None
