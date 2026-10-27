from clips_worker.streamer.stream_pipeline import user_retry_progress_payload


def test_user_retry_progress_payload_includes_project_status():
    body = user_retry_progress_payload(30, "timeout")
    assert body["jobStatus"] == "RUNNING"
    assert body["projectStatus"] == "TRANSCRIBING"
    assert "30s" in body["error"]
