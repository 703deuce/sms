import time

from clips_worker.clip_progress import reframe_eta_seconds, reframe_progress_payload


def test_reframe_progress_includes_eta():
    started = time.time() - 130
    payload = reframe_progress_payload(2, 4, started, concurrency=2)
    assert payload["stage"] == "reframe_3_of_4"
    assert payload["etaSeconds"] >= 0
    assert "progress" in payload


def test_reframe_eta_fallback_when_no_completions():
    eta = reframe_eta_seconds(0, 4, time.time(), concurrency=2)
    assert eta == 4 // 2 * 65
