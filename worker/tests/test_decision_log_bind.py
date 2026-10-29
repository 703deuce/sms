from unittest.mock import MagicMock

from clips_worker.decision_log import bind_decision_log, decision_log, flush_decision_log, unbind_decision_log


def test_stream_render_bind_pattern(monkeypatch):
    payloads: list[dict] = []

    def fake_merge(_conn, _job_id, patch):
        payloads.append(dict(patch))
        return patch

    monkeypatch.setattr("clips_worker.picker_checkpoint.merge_job_payload", fake_merge)
    conn = MagicMock()
    bind_decision_log(conn, "job_render")
    decision_log("streamer", "segment_align", clipId="c1", applied=False)
    flush_decision_log(force=True)
    assert payloads[-1]["decisionLog"][0]["stage"] == "streamer"
    unbind_decision_log()
