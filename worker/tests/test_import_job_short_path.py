import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_mock_boto3 = MagicMock()
sys.modules.setdefault("boto3", _mock_boto3)
sys.modules.setdefault("boto3.s3", MagicMock())
sys.modules.setdefault("boto3.s3.transfer", MagicMock())
sys.modules.setdefault("botocore", MagicMock())
sys.modules.setdefault("botocore.config", MagicMock())
sys.modules.setdefault("botocore.exceptions", MagicMock())
sys.modules.setdefault("psycopg2", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

from clips_worker.streamer.import_job import run_stream_import_job


def test_short_url_import_uses_cache_dir_not_td(tmp_path, monkeypatch):
    """URL imports <= FULL_DOWNLOAD_MAX_MIN must not reference upload-branch `td`."""
    from clips_worker.streamer import import_cache

    monkeypatch.setattr(import_cache, "SCRATCH", tmp_path)
    vod_id = "vod_test123"
    cache_dir = import_cache.vod_import_dir(vod_id)

    vod = {
        "id": vod_id,
        "url": "https://example.com/vod",
        "workspaceId": "ws1",
        "project_id": "proj1",
        "sourceType": "vod",
        "rangeStartMs": 0,
        "rangeEndMs": 600_000,
        "triggeredBy": "paste",
    }
    job = {"id": "job1", "payload": json.dumps({"vodId": vod_id})}

    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.return_value = vod

    uploaded_audio: list[str] = []

    def fake_upload(key, path, mime):
        if "audio" in key:
            uploaded_audio.append(str(path))
            assert Path(path).parent == cache_dir

    with (
        patch("clips_worker.streamer.import_job._maybe_complete_import_from_state", return_value=False),
        patch("clips_worker.streamer.import_job.Heartbeat"),
        patch("clips_worker.streamer.import_job.metadata", return_value={}),
        patch("clips_worker.streamer.import_job.parse_metadata", return_value={"duration_s": 600, "title": "t"}),
        patch("clips_worker.streamer.import_job.check_cap", return_value=None),
        patch("clips_worker.streamer.import_job.download_video") as dl,
        patch("clips_worker.streamer.import_job.probe_video", return_value=(600.0, 1920, 1080)),
        patch("clips_worker.streamer.import_job.upload_file", side_effect=fake_upload),
        patch("clips_worker.streamer.import_job.upload_source_key", return_value="src/key"),
        patch("clips_worker.streamer.import_job.stream_audio_key", return_value="audio/key"),
        patch("clips_worker.streamer.import_job.job_priority", return_value=0),
        patch("clips_worker.streamer.import_job.subprocess.check_call") as ff,
        patch("clips_worker.streamer.import_job.sweep_stale_failed_import_dirs"),
        patch("clips_worker.streamer.import_job.cleanup_vod_import_dir"),
    ):
        def write_mp4(url, dest, *a, **k):
            Path(dest).write_bytes(b"fake")

        dl.side_effect = write_mp4

        def ffmpeg(args, *a, **k):
            out = Path(args[-1])
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(b"opus")

        ff.side_effect = ffmpeg

        run_stream_import_job(conn, job, MagicMock())

    assert uploaded_audio
