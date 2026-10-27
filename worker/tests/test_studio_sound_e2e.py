"""Studio Sound pipeline: job registration + audio_assets load when generation READY."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from clips_worker.audio_assets import load_audio_assets
from clips_worker.job_types import JOB_TYPES


def test_studio_sound_job_type_listed():
    assert "STUDIO_SOUND" in JOB_TYPES


def test_load_audio_assets_studio_when_ready(tmp_path):
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: cur
    conn.cursor.return_value.__exit__ = lambda *a: None
    cur.fetchone.return_value = ("ws/x/studio.mp3", "READY")

    edits = {
        "audio": {
            "studioSound": {"enabled": True, "generationId": "gen_studio1", "mix": 0.75},
        }
    }

    fake_storage = MagicMock()
    fake_storage.download_object.side_effect = lambda _key, dest: Path(dest).write_bytes(b"mp3")
    with patch.dict(sys.modules, {"clips_worker.storage": fake_storage}):
        assets = load_audio_assets(conn, edits, tmp_path)

    assert assets["studio_path"] is not None
    assert assets["studio_mix"] == 0.75
    fake_storage.download_object.assert_called_once()


def test_studio_sound_job_short_circuits_when_ready():
    fake_storage = MagicMock()
    with patch.dict(
        sys.modules,
        {"boto3": MagicMock(), "botocore": MagicMock(), "clips_worker.storage": fake_storage},
    ):
        from clips_worker.studio_sound_job import run_studio_sound_job

        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value.__enter__ = lambda s: cur
        conn.cursor.return_value.__exit__ = lambda *a: None
        cur.fetchone.return_value = ("gen1", "ws1", "READY", "{}")
        progress = MagicMock()
        run_studio_sound_job(
            conn,
            {"id": "job1", "projectId": "p1", "payload": {"generationId": "gen1"}},
            progress,
        )
        progress.assert_called_once()
        assert progress.call_args[0][1]["jobStatus"] == "DONE"

