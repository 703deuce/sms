"""decisionLog persistence and cap."""
from __future__ import annotations

import json
from unittest.mock import MagicMock

from clips_worker.decision_log import (
    MAX_DECISION_LOG_ENTRIES,
    bind_decision_log,
    decision_log,
    decision_log_snapshot,
    flush_decision_log,
    sanitize_model_json,
    unbind_decision_log,
)


def test_decision_log_prints_and_caps_buffer():
    bind_decision_log(None, None)
    for i in range(MAX_DECISION_LOG_ENTRIES + 25):
        decision_log("test", "tick", index=i)
    snap = decision_log_snapshot()
    assert len(snap) == MAX_DECISION_LOG_ENTRIES
    assert snap[0]["index"] == 25
    unbind_decision_log()


def test_decision_log_persisted_via_merge_job_payload(monkeypatch):
    conn = MagicMock()
    payloads: list[dict] = []

    def fake_merge(_conn, _job_id, patch):
        payloads.append(dict(patch))
        return patch

    monkeypatch.setattr(
        "clips_worker.picker_checkpoint.merge_job_payload",
        fake_merge,
    )
    bind_decision_log(conn, "job_test")
    decision_log("plan_clips", "pipeline_plan", input_count=2, output_count=1)
    flush_decision_log(force=True)
    assert payloads
    log = payloads[-1]["decisionLog"]
    assert len(log) == 1
    assert log[0]["stage"] == "plan_clips"
    unbind_decision_log()


def test_sanitize_model_json_strips_urls():
    raw = {"moments": [{"what_happened": "see https://secret.example/x?token=abc"}]}
    text = sanitize_model_json(raw)
    assert "https://" not in text
    assert "token=abc" not in text


def test_decision_log_line_format(capsys):
    bind_decision_log(None, None)
    decision_log("video_picker", "model_attempt", model="gemini-test", ok=True)
    out = capsys.readouterr().out
    assert "[clipper:decision]" in out
    payload = out.split("[clipper:decision]", 1)[1].strip()
    rec = json.loads(payload)
    assert rec["stage"] == "video_picker"
    unbind_decision_log()
