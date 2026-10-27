from clips_worker.streamer.job_failure import terminal_failure_progress_payload


def test_stream_relayout_failure_does_not_fail_project():
    payload = terminal_failure_progress_payload("STREAM_RELAYOUT", "layout blew up")
    assert payload == {"jobStatus": "FAILED"}
    assert "projectStatus" not in payload


def test_stream_montage_failure_does_not_fail_project():
    payload = terminal_failure_progress_payload("STREAM_MONTAGE", "montage blew up")
    assert payload == {"jobStatus": "FAILED"}
    assert "projectStatus" not in payload


def test_stream_cleanup_failure_does_not_fail_project():
    payload = terminal_failure_progress_payload("STREAM_CLEANUP", "cleanup blew up")
    assert payload == {"jobStatus": "FAILED"}


def test_stream_analyze_failure_still_fails_project():
    payload = terminal_failure_progress_payload("STREAM_ANALYZE", "analyze blew up")
    assert payload["projectStatus"] == "FAILED"
    assert payload["jobStatus"] == "FAILED"
