"""Batch V — growing live import must enqueue STREAM_ANALYZE (same path as rolling complete)."""
from unittest.mock import MagicMock, patch


def _mock_conn_with_analyze_insert():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cursor


@patch("clips_worker.streamer.import_job._schedule_rolling_import_tick")
@patch("clips_worker.streamer.project_cancel.load_project_operator_cancelled", return_value=False)
@patch("clips_worker.streamer.import_job._has_pending_stream_analyze", return_value=False)
@patch("clips_worker.streamer.import_job.job_priority", return_value=15)
@patch("clips_worker.streamer.import_job.cleanup_vod_import_dir")
def test_growing_live_import_enqueues_stream_analyze(
    _cleanup,
    _pri,
    _pending_analyze,
    _mock_cancelled,
    _schedule_tick,
):
    from clips_worker.streamer.import_job import _complete_rolling_window_import

    conn, cursor = _mock_conn_with_analyze_insert()
    job = {"id": "job_import1"}
    vod = {
        "rangeStartMs": 120_000,
        "rangeEndMs": 300_000,
        "workspaceId": "ws_1",
        "triggeredBy": "paste",
        "state": {"rolling": {"chunkMin": 3}},
    }
    hb = MagicMock()

    _complete_rolling_window_import(
        conn,
        job=job,
        vod=vod,
        project_id="proj_1",
        vod_id="svod_1",
        payload={},
        state={"audioKey": "k"},
        meta={"title": "live"},
        duration_ms=180_000,
        post_progress=MagicMock(),
        hb=hb,
        analyze_source="growing_live_import",
        schedule_growing_tick=True,
    )

    sql_calls = " ".join(str(args[0]) for args, _ in cursor.execute.call_args_list)
    assert "STREAM_ANALYZE" in sql_calls
    _schedule_tick.assert_called_once()


def test_growing_branch_routes_through_complete():
    import inspect

    from clips_worker import streamer

    src = inspect.getsource(streamer.import_job._run_stream_import_job_inner)
    assert "analyze_source=\"growing_live_import\"" in src
    assert "schedule_growing_tick=True" in src
    assert "SET title=COALESCE(%s, title), stage='live_ingest', progress=15" not in src
