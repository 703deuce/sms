"""FIND_CLIPS job unit tests."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from clips_worker.find_clips_job import make_find_progress, noop_mark_project_ready, persist_find_result


def test_find_progress_drops_project_fields():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    posted: list[dict] = []

    def post_progress(_jid, payload):
        posted.append(dict(payload))

    fp = make_find_progress(conn, "job_1", post_progress)
    fp(
        "job_1",
        {
            "projectStatus": "FINDING_CLIPS",
            "stage": "picker_done",
            "progress": 55,
            "projectError": "x",
            "jobStatus": "RUNNING",
            "videoPickerModel": "gpt",
        },
    )
    assert posted == [{"jobStatus": "RUNNING", "videoPickerModel": "gpt"}]
    cur.execute.assert_called()


def test_run_m4_pipeline_find_only_skips_render(monkeypatch):
    calls = {"reframe": 0, "persist": 0, "mark_ready": 0}

    def fake_plan_or_finish_empty(*_a, **_k):
        return [{"start_ms": 1000, "end_ms": 5000, "score": 90, "title": "T", "hook": "h"}]

    monkeypatch.setattr("clips_worker.pipeline_plan.plan_or_finish_empty", fake_plan_or_finish_empty)

    def fake_pick(*_a, **_k):
        return ([{"start_ms": 1000, "end_ms": 5000, "score": 90, "title": "T", "hook": "h"}], None)

    monkeypatch.setattr("clips_worker.pipeline.pick_talking_clips", fake_pick)

    def fake_reframe(*_a, **_k):
        calls["reframe"] += 1

    monkeypatch.setattr("clips_worker.pipeline.reframe_clip_preview", fake_reframe)

    def track_persist(conn, job_id, planned, **kw):
        calls["persist"] += 1
        assert len(planned) == 1

    monkeypatch.setattr("clips_worker.find_clips_job.persist_find_result", track_persist)

    def track_ready(conn, project_id, error=None):
        calls["mark_ready"] += 1

    monkeypatch.setattr("clips_worker.pipeline.mark_project_ready", track_ready)
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/test")

    from clips_worker.pipeline import run_m4_pipeline

    conn = MagicMock()
    project = {
        "id": "proj_1",
        "workspaceId": "ws_1",
        "settings": {"mode": "auto"},
        "rangeStartMs": 0,
        "rangeEndMs": 60_000,
    }
    words = [{"w": "hi", "s": 0.0, "e": 1.0}]
    posted: list[dict] = []

    run_m4_pipeline(
        conn,
        "job_1",
        project,
        words,
        "key",
        lambda _j, p: posted.append(p),
        job={"id": "job_1", "payload": {}},
        local_src=__import__("pathlib").Path("/dev/null"),
        local_audio_wav=__import__("pathlib").Path("/dev/null"),
        find_only=True,
    )
    assert calls["persist"] == 1
    assert calls["reframe"] == 0
    assert calls["mark_ready"] == 0


def test_find_only_zero_picks_no_mark_ready(monkeypatch):
    mark_calls: list[tuple] = []

    def fake_plan(*_a, mark_project_ready=None, **_k):
        mark_project_ready(None, "proj", "empty")
        return None

    monkeypatch.setattr("clips_worker.pipeline_plan.plan_or_finish_empty", fake_plan)
    monkeypatch.setattr(
        "clips_worker.pipeline.pick_talking_clips",
        lambda *_a, **_k: ([], "none"),
    )
    persisted: list[list] = []

    def track_persist(conn, job_id, planned, **kw):
        persisted.append(list(planned or []))

    monkeypatch.setattr("clips_worker.find_clips_job.persist_find_result", track_persist)
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/test")

    from clips_worker.pipeline import run_m4_pipeline

    conn = MagicMock()
    project = {
        "id": "proj_1",
        "workspaceId": "ws_1",
        "settings": {"mode": "auto"},
        "rangeStartMs": 0,
        "rangeEndMs": 60_000,
    }
    run_m4_pipeline(
        conn,
        "job_1",
        project,
        [],
        "key",
        lambda *_a, **_k: None,
        job={"id": "job_1", "payload": {}},
        local_src=__import__("pathlib").Path("/dev/null"),
        local_audio_wav=__import__("pathlib").Path("/dev/null"),
        find_only=True,
    )
    assert persisted == [[]]


def test_dispatch_includes_find_clips():
    from pathlib import Path

    text = Path(__file__).resolve().parents[1].joinpath("clips_worker", "main.py").read_text()
    assert '"FIND_CLIPS": handle_find_clips_entry' in text
    from clips_worker.job_types import JOB_TYPES

    assert "FIND_CLIPS" in JOB_TYPES


def test_transcribe_passes_asr_language_from_settings():
    conn = MagicMock()
    project = {"workspaceId": "ws", "id": "proj", "settings": {"asrLanguage": "es"}}
    src = __import__("pathlib").Path(__file__)

    captured = {}

    def fake_transcribe(_conn, req, _ws, _pid):
        captured["language"] = req.language
        from clips_worker.transcribe_provider import TranscribeMeta

        return MagicMock(words=[]), TranscribeMeta(transcription_engine="test")

    with patch("clips_worker.transcribe_source.transcribe_audio_request", side_effect=fake_transcribe):
        with patch("clips_worker.transcribe_source._extract_opus_16k"):
            with patch("clips_worker.transcribe_source.upload_file"):
                with patch("clips_worker.transcribe_source.sign_url", return_value="http://x"):
                    with patch.dict("os.environ", {"GPU_PROVIDER": "local"}, clear=False):
                        from clips_worker.transcribe_source import transcribe_video_file

                        transcribe_video_file(conn, project, src, model="small.en")
    assert captured.get("language") == "es"


def test_noop_mark_ready():
    noop_mark_project_ready(None, "p", "e")


def test_persist_find_result_writes_payload():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    persist_find_result(
        conn,
        "job_x",
        [{"start_ms": 0, "end_ms": 1000, "score": 1, "title": "A", "hook": "h"}],
        words=[],
        settings={"mode": "auto"},
    )
    cur.execute.assert_called_once()
