from clips_worker.progress_throttle import ThrottledProgressPoster


def test_throttles_rapid_progress():
    calls: list[dict] = []

    def post(job_id: str, payload: dict) -> None:
        calls.append(payload)

    t = ThrottledProgressPoster(post, "job_x", min_interval_s=10.0, min_delta_pct=5.0)
    t.post({"progress": 1, "jobStatus": "RUNNING"})
    t.post({"progress": 2, "jobStatus": "RUNNING"})
    t.post({"progress": 10, "jobStatus": "RUNNING"})
    assert len(calls) == 2
    assert calls[0]["progress"] == 1
    assert calls[1]["progress"] == 10
