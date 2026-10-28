"""Y1: rolling_tick chunkMin merge + live capture decision logging."""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from clips_worker.decision_log import bind_decision_log, decision_log, merge_decision_fields, unbind_decision_log
from clips_worker.streamer.live_capture import apply_live_capture_pull_plan, ingest_live_capture_audio
from clips_worker.streamer.rolling_ingest import log_rolling_tick_decision, rolling_limits_snapshot


def _live_capture_state() -> dict:
    return {
        "liveCapture": True,
        "streamStartedAt": "2026-10-28T11:00:00+00:00",
        "archiveResolveReason": "helix_no_archives_live_channel_url",
        "channelLogin": "indiavvsofficial",
        "processMode": "rolling",
        "rolling": {
            "chunkMin": 3,
            "chunkMinSource": "paste_range_span",
            "live": True,
        },
    }


def test_merge_decision_fields_later_chunk_min_wins():
    base = rolling_limits_snapshot(_live_capture_state())
    assert base["chunkMin"] == 3
    merged = merge_decision_fields(base, chunkMin=5, vodId="svod_x")
    assert merged["chunkMin"] == 5
    assert merged["vodId"] == "svod_x"


def test_log_rolling_tick_decision_no_duplicate_chunk_min(capsys):
    bind_decision_log(None, None)
    log_rolling_tick_decision(
        vod_id="svod_test",
        range_start_ms=1_700_000,
        range_end_ms=1_880_000,
        chunk_min=5,
        next_run_after=None,
        source="pull_plan",
        state=_live_capture_state(),
    )
    out = capsys.readouterr().out
    assert "[clipper:decision]" in out
    rolling_lines = [
        ln.split("[clipper:decision]", 1)[1].strip()
        for ln in out.splitlines()
        if "[clipper:decision]" in ln and '"event": "rolling_tick"' in ln
    ]
    assert rolling_lines
    rec = json.loads(rolling_lines[-1])
    assert rec["event"] == "rolling_tick"
    assert rec["chunkMin"] == 5
    assert rec["chunkMinSource"] == "paste_range_span"
    unbind_decision_log()


def test_decision_log_swallows_internal_errors(capsys, monkeypatch):
    bind_decision_log(None, None)

    def boom(_rec):
        raise RuntimeError("truncate blew up")

    monkeypatch.setattr("clips_worker.decision_log._truncate_record", boom)
    decision_log("stream_import", "import_begin", vodId="svod_y")
    err = capsys.readouterr().out
    assert "logging_failed" in err
    unbind_decision_log()


def test_apply_live_capture_pull_plan_logs_plan_not_rolling_tick():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    vod = {
        "id": "svod_lc",
        "project_id": "proj_lc",
        "channelId": "sch_1",
        "channelLogin": "indiavvsofficial",
        "state": _live_capture_state(),
    }
    events: list[str] = []

    def capture_log(stage, event, **fields):
        events.append(event)

    with patch("clips_worker.decision_log.decision_log", side_effect=capture_log):
        with patch(
            "clips_worker.streamer.live_capture.plan_live_capture_window_ms",
            return_value=(1_700_000, 1_880_000),
        ):
            out = apply_live_capture_pull_plan(conn, vod, finalize=False, job_id="job_lc")
    assert out == (1_700_000, 1_880_000)
    assert "live_capture_plan" in events
    assert "rolling_tick" not in events


def test_ingest_live_capture_begin_before_metadata():
    calls: list[str] = []

    def fake_log(stage, event, **fields):
        calls.append(event)

    with patch("clips_worker.decision_log.decision_log", side_effect=fake_log):
        with patch(
            "clips_worker.streamer.ytdlp.metadata",
            side_effect=lambda *a, **k: (_ for _ in ()).throw(AssertionError("metadata before begin")),
        ):
            with pytest.raises(AssertionError):
                ingest_live_capture_audio(
                    "https://www.twitch.tv/indiavvsofficial",
                    duration_s=180,
                    job_id="job_1",
                    vod_id="svod_1",
                    login="indiavvsofficial",
                    offset_ms=1_700_000,
                    chunk_min=3,
                    archive_resolve_reason="helix_no_archives_live_channel_url",
                )
    assert calls[0] == "live_capture_begin"


def test_import_job_schedule_tick_after_live_capture_end():
    """rolling_import_scheduled only runs from _complete_rolling_window_import (after capture)."""
    import inspect

    from clips_worker.streamer import import_job

    src = inspect.getsource(import_job._run_stream_import_job_inner)
    lc = src.index("is_twitch_live_capture(vod)")
    complete = src.index("_complete_rolling_window_import", lc)
    begin = src.index("ingest_live_capture_audio", lc)
    assert begin < complete
