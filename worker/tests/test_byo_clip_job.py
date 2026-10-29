"""BYO finalize path (single clip after transcription, before M4 pipeline)."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from clips_worker.byo_clip_job import finalize_byo_clip
from clips_worker.user_errors import ClipUserError


def test_finalize_inserts_expected_row(monkeypatch, tmp_path: Path) -> None:
    src = tmp_path / "source.mp4"
    src.write_bytes(b"\x00\x00")

    monkeypatch.setattr("clips_worker.byo_clip_job.probe_duration", lambda _p: 25.0)
    monkeypatch.setattr("clips_worker.byo_clip_job._probe_video_wh", lambda _p: (1080, 1920))
    monkeypatch.setattr(
        "clips_worker.byo_clip_job.initial_clip_edits",
        lambda _s: {"captions": {"enabled": True}, "aspectRatio": "9:16"},
    )
    monkeypatch.setattr("clips_worker.byo_clip_job.upload_file", lambda *a, **k: None)
    monkeypatch.setattr("clips_worker.byo_clip_job._poster_frame_jpg", lambda *a, **k: None)

    inserted: list[dict] = []

    def fake_insert(conn, rows):
        inserted.extend(rows)
        return len(rows)

    monkeypatch.setattr("clips_worker.byo_clip_job.insert_clips_batch", fake_insert)
    monkeypatch.setattr("clips_worker.byo_clip_job.mark_project_ready", lambda *a, **k: None)

    progress: list[dict] = []

    def post_progress(job_id, payload):
        progress.append(payload)

    job = {"id": "job_test"}
    project = {
        "id": "proj_test",
        "workspaceId": "ws_test",
        "title": "My short",
        "settings": {"aspectRatio": "9:16", "captions": {"enabled": True}},
    }
    words = [{"w": "hi", "s": 0, "e": 0.5}]

    finalize_byo_clip(MagicMock(), job, project, words, src, post_progress)

    assert len(inserted) == 1
    row = inserted[0]
    assert row["startMs"] == 0
    assert row["endMs"] == 25_000
    assert row["segmentKey"] is None
    assert row["aiMeta"]["byo"] is True
    assert row["previewKey"] is None
    assert row["wordsKey"] is None
    assert progress[-1]["jobStatus"] == "DONE"


def test_finalize_rejects_over_3_minutes(monkeypatch, tmp_path: Path) -> None:
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    monkeypatch.setattr("clips_worker.byo_clip_job.probe_duration", lambda _p: 200.0)

    with pytest.raises(ClipUserError, match="3 minutes"):
        finalize_byo_clip(
            MagicMock(),
            {"id": "j"},
            {"id": "p", "workspaceId": "w", "title": "t", "settings": {}},
            [],
            src,
            lambda *_: None,
        )


def test_poster_failure_still_inserts(monkeypatch, tmp_path: Path) -> None:
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    monkeypatch.setattr("clips_worker.byo_clip_job.probe_duration", lambda _p: 10.0)
    monkeypatch.setattr("clips_worker.byo_clip_job._probe_video_wh", lambda _p: (720, 1280))
    monkeypatch.setattr("clips_worker.byo_clip_job.initial_clip_edits", lambda _s: {})

    def fail_upload(*_a, **_k):
        raise RuntimeError("upload fail")

    monkeypatch.setattr("clips_worker.byo_clip_job.upload_file", fail_upload)

    inserted: list[dict] = []

    def capture(_c, rows):
        inserted.extend(rows)
        return len(rows)

    monkeypatch.setattr("clips_worker.byo_clip_job.insert_clips_batch", capture)
    monkeypatch.setattr("clips_worker.byo_clip_job.mark_project_ready", lambda *a, **k: None)

    finalize_byo_clip(
        MagicMock(),
        {"id": "j"},
        {"id": "p", "workspaceId": "w", "title": "t", "settings": {}},
        [],
        src,
        lambda *_: None,
    )
    assert inserted[0]["posterKey"] is None


def test_initial_clip_edits_fallback_empty(monkeypatch, tmp_path: Path) -> None:
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    monkeypatch.setattr("clips_worker.byo_clip_job.probe_duration", lambda _p: 8.0)
    monkeypatch.setattr("clips_worker.byo_clip_job._probe_video_wh", lambda _p: (720, 1280))

    def boom(_s):
        raise RuntimeError("bad settings")

    monkeypatch.setattr("clips_worker.byo_clip_job.initial_clip_edits", boom)
    monkeypatch.setattr("clips_worker.byo_clip_job.upload_file", lambda *a, **k: None)
    monkeypatch.setattr("clips_worker.byo_clip_job._poster_frame_jpg", lambda *a, **k: None)

    inserted: list[dict] = []

    monkeypatch.setattr(
        "clips_worker.byo_clip_job.insert_clips_batch",
        lambda _c, rows: inserted.extend(rows) or len(rows),
    )
    monkeypatch.setattr("clips_worker.byo_clip_job.mark_project_ready", lambda *a, **k: None)

    finalize_byo_clip(
        MagicMock(),
        {"id": "j"},
        {"id": "p", "workspaceId": "w", "title": "t", "settings": {}},
        [],
        src,
        lambda *_: None,
    )
    assert inserted[0]["edits"]["trim"]["out"] == 8000


def test_non_byo_process_job_calls_pipeline_not_finalize(monkeypatch, tmp_path: Path) -> None:
    pipeline_calls: list[str] = []
    finalize_calls: list[str] = []

    monkeypatch.setattr(
        "clips_worker.byo_clip_job.finalize_byo_clip",
        lambda *a, **k: finalize_calls.append("called"),
    )
    monkeypatch.setattr(
        "clips_worker.main.run_m4_pipeline",
        lambda *a, **k: pipeline_calls.append("called"),
    )
    monkeypatch.setattr("clips_worker.main.download_object", lambda key, dest: dest.write_bytes(b"vid"))
    monkeypatch.setattr("clips_worker.main.probe_duration", lambda _p: 60.0)
    monkeypatch.setattr("clips_worker.main.extract_wav_for_picker", lambda *a, **k: None)
    tx_meta = MagicMock()
    tx_meta.as_progress_fields.return_value = {}
    monkeypatch.setattr(
        "clips_worker.main.transcribe_video_file",
        lambda *a, **k: ([{"w": "a", "s": 0, "e": 1}], tx_meta),
    )
    monkeypatch.setattr("clips_worker.main.post_progress", lambda *a, **k: None)
    monkeypatch.setattr(
        "clips_worker.main.load_project",
        lambda _c, _id: {
            "id": "proj_x",
            "workspaceId": "ws",
            "status": "QUEUED",
            "source_key": "k",
            "settings": {},
        },
    )
    monkeypatch.setattr("clips_worker.process_helpers.resolve_transcript_for_job", lambda _p, _pl: None)
    monkeypatch.setattr("clips_worker.main.schedule_modal_warmup_background", lambda: None, raising=False)
    monkeypatch.setattr(
        "clips_worker.gpu.render_warmup.schedule_modal_warmup_background",
        lambda: None,
    )

    from clips_worker.main import process_job

    job = {"id": "job1", "projectId": "proj_x", "type": "PROCESS_PROJECT", "payload": {}}
    process_job(MagicMock(), job)
    assert finalize_calls == []
    assert pipeline_calls == ["called"]
