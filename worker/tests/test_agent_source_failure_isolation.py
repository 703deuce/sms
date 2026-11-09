from clips_worker.streamer.job_failure import terminal_failure_progress_payload

def test_agent_side_jobs_do_not_fail_source_project():
    for kind in ("AI_PRODUCER_AGENT_ANALYZE", "AI_PRODUCER_AGENT_RUN", "STREAM_AGENT_BATCH"):
        body = terminal_failure_progress_payload(kind, "missing source")
        assert body["jobStatus"] == "FAILED"
        assert "projectStatus" not in body

def test_process_project_failure_still_marks_project_failed():
    body = terminal_failure_progress_payload("PROCESS_PROJECT", "bad input")
    assert body["projectStatus"] == "FAILED"
