"""E2E-ish: run_m4_pipeline talking mode with mocked picker/render to clip row dicts."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def words_60s():
    return [{"w": "word", "s": i * 0.5, "e": i * 0.5 + 0.4} for i in range(120)]


def _mock_pg_conn():
    ins_conn = MagicMock()
    ins_cur = MagicMock()
    ins_conn.cursor.return_value.__enter__ = MagicMock(return_value=ins_cur)
    ins_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=ins_conn)
    cm.__exit__ = MagicMock(return_value=False)
    return cm


def _clip_row(idx: int, project_id: str, workspace_id: str) -> dict:
    start = 0 if idx == 0 else 25_000
    end = 20_000 if idx == 0 else 55_000
    return {
        "id": f"clip_{idx}",
        "projectId": project_id,
        "workspaceId": workspace_id,
        "title": f"Clip {idx}",
        "reason": "test",
        "startMs": start,
        "endMs": end,
        "score": 90 - idx,
        "scores": {},
        "previewKey": f"preview/{idx}",
        "posterKey": f"poster/{idx}",
        "wordsKey": f"words/{idx}",
        "cropKey": None,
        "edits": {},
        "aiMeta": {},
    }


def test_run_m4_pipeline_produces_clip_rows(words_60s, tmp_path):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00")
    wav = tmp_path / "audio.wav"
    wav.write_bytes(b"RIFF")

    picks = [
        {"start_ms": 0, "end_ms": 20_000, "score": 90, "title": "Hook moment", "hook": "Hook", "reason": "Strong", "scores": {"hook": "A"}},
        {"start_ms": 25_000, "end_ms": 55_000, "score": 85, "title": "Payoff", "hook": "Payoff", "reason": "Value", "scores": {"hook": "B"}},
    ]

    captured: list[dict] = []

    def fake_pool(count, _conc, _worker, on_start=None, on_complete=None, index_order=None, **_kw):
        order = list(index_order) if index_order is not None else list(range(count))
        rows = []
        for idx in order:
            if on_start:
                on_start(idx, count)
            row = _clip_row(idx, "proj_test", "ws_test")
            rows.append(row)
            if on_complete:
                on_complete(idx, row)
        return rows

    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    project = {
        "id": "proj_test",
        "workspaceId": "ws_test",
        "title": "Fixture",
        "settings": {"mode": "talking", "genre": "podcast"},
        "rangeStartMs": 0,
        "rangeEndMs": 60_000,
    }

    import os

    os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

    with (
        patch("clips_worker.pipeline.pick_talking_clips", return_value=(picks, None)),
        patch("clips_worker.pipeline.psycopg2.connect", return_value=_mock_pg_conn()),
        patch("clips_worker.pipeline.run_bounded_indexed_pool", side_effect=fake_pool),
        patch("clips_worker.pipeline.insert_clips_batch", side_effect=lambda _c, rows: captured.extend(rows)),
        patch("clips_worker.pipeline.clips_render_concurrency", return_value=1),
    ):
        from clips_worker.pipeline import run_m4_pipeline

        run_m4_pipeline(
            conn,
            "job_test",
            project,
            words_60s,
            "ws/ws_test/uploads/up/source.mp4",
            lambda *_a, **_k: None,
            job={},
            local_src=src,
            local_audio_wav=wav,
        )

    assert len(captured) >= 2
    for row in captured:
        assert row["projectId"] == "proj_test"
        assert row["workspaceId"] == "ws_test"
        assert row["previewKey"]
        assert row["endMs"] > row["startMs"]
