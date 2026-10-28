"""Rolling live Twitch ingest: non-overlapping VOD windows, cost guards, pull logging."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from clips_worker.streamer.config import _int


def rolling_chunk_min(state: dict) -> int:
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    raw = int(rolling.get("chunkMin") or _int("STREAMER_ROLLING_CHUNK_MIN", 8))
    return max(3, min(60, raw))


def rolling_pull_overlap_ms() -> int:
    """Max overlap between consecutive rolling windows (analyze continuity)."""
    return min(30_000, max(0, _int("STREAMER_ROLLING_OVERLAP_MS", 30_000)))


def rolling_min_new_ms_for_state(state: dict) -> int:
    chunk_ms = rolling_chunk_min(state) * 60_000
    default = _int("STREAMER_ROLLING_MIN_NEW_MS", 45_000)
    return min(default, max(15_000, chunk_ms // 6))


def rolling_max_window_ms() -> int:
    return _int("STREAMER_ROLLING_MAX_WINDOW_MS", 15 * 60 * 1000)


def rolling_max_session_hours() -> int:
    return _int("STREAMER_ROLLING_MAX_SESSION_HOURS", 8)


def rolling_min_new_ms() -> int:
    return _int("STREAMER_ROLLING_MIN_NEW_MS", 45_000)


def plan_rolling_window_ms(
    *,
    total_vod_ms: int,
    state: dict,
    finalize: bool,
) -> tuple[int, int] | None | str:
    """
    Return (start_ms, end_ms) absolute offsets in the archive VOD,
    None if nothing new to pull yet, or 'stop_session' when max duration hit.
    """
    if total_vod_ms <= 0:
        return None
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    last_pulled = int(rolling.get("lastPulledMs") or 0)
    chunk_ms = rolling_chunk_min(state) * 60_000
    max_window = rolling_max_window_ms()
    overlap_ms = rolling_pull_overlap_ms()
    min_new_ms = rolling_min_new_ms_for_state(state)

    if finalize:
        start_ms = last_pulled
        end_ms = total_vod_ms
    else:
        end_ms = total_vod_ms
        if end_ms <= last_pulled + min_new_ms:
            return None
        # Live edge chunk: from previous pull end (≤30s overlap) through current archive end.
        start_ms = max(0, last_pulled - overlap_ms, end_ms - chunk_ms)
        if end_ms - start_ms > chunk_ms + overlap_ms:
            start_ms = max(0, end_ms - chunk_ms)

    if start_ms >= end_ms:
        return None
    if end_ms - start_ms > max_window:
        start_ms = end_ms - max_window

    started_raw = rolling.get("sessionStartedAt") or rolling.get("lastPullAt")
    if started_raw:
        try:
            started = datetime.fromisoformat(str(started_raw).replace("Z", "+00:00"))
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            elapsed_h = (datetime.now(timezone.utc) - started).total_seconds() / 3600.0
            if elapsed_h > rolling_max_session_hours():
                return "stop_session"
        except (TypeError, ValueError):
            pass
    elif end_ms > rolling_max_session_hours() * 3600_000:
        return "stop_session"

    return start_ms, end_ms


def log_rolling_pull(
    *,
    channel_id: str | None,
    vod_id: str,
    project_id: str,
    job_id: str,
    start_ms: int,
    end_ms: int,
    finalize: bool,
) -> None:
    ch = channel_id or "unknown"
    print(
        f"[clipper:autopull] rolling_pull channelId={ch} vodId={vod_id} projectId={project_id} "
        f"jobId={job_id} windowStartMs={start_ms} windowEndMs={end_ms} "
        f"windowMin={(end_ms - start_ms) // 60_000} finalize={str(finalize).lower()}",
        flush=True,
    )


def apply_rolling_pull_plan(
    conn,
    vod: dict[str, Any],
    *,
    total_vod_ms: int,
    finalize: bool,
    job_id: str,
) -> tuple[int, int] | None | str:
    """Persist planned window on vod + project; return plan outcome."""
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    plan = plan_rolling_window_ms(total_vod_ms=total_vod_ms, state=state, finalize=finalize)
    if plan is None or plan == "stop_session":
        return plan
    start_ms, end_ms = plan
    rolling = dict(state.get("rolling") or {})
    if not rolling.get("sessionStartMs"):
        streamed = vod.get("streamedAt")
        if streamed:
            if hasattr(streamed, "timestamp"):
                rolling["sessionStartMs"] = int(streamed.timestamp() * 1000)
            else:
                rolling["sessionStartMs"] = 0
    rolling["lastPullPlannedMs"] = end_ms
    rolling["lastPullAt"] = datetime.now(timezone.utc).isoformat()
    state = {**state, "processMode": "rolling", "rolling": rolling}
    project_id = vod["project_id"]
    vod_id = vod["id"]
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_vods
            SET "rangeStartMs"=%s, "rangeEndMs"=%s, "durationMs"=%s, state=%s::jsonb, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (start_ms, end_ms, max(1, end_ms - start_ms), json.dumps(state), vod_id),
        )
        cur.execute(
            """
            UPDATE clip_projects
            SET "rangeStartMs"=%s, "rangeEndMs"=%s, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (start_ms, end_ms, project_id),
        )
    conn.commit()
    vod["rangeStartMs"] = start_ms
    vod["rangeEndMs"] = end_ms
    vod["durationMs"] = end_ms - start_ms
    vod["state"] = state
    log_rolling_pull(
        channel_id=str(vod.get("channelId") or "") or None,
        vod_id=vod_id,
        project_id=project_id,
        job_id=job_id,
        start_ms=start_ms,
        end_ms=end_ms,
        finalize=finalize,
    )
    log_rolling_tick_decision(
        vod_id=vod_id,
        range_start_ms=start_ms,
        range_end_ms=end_ms,
        chunk_min=rolling_chunk_min(state),
        next_run_after=None,
        source="pull_plan",
    )
    return start_ms, end_ms


def log_rolling_tick_decision(
    *,
    vod_id: str,
    range_start_ms: int | None,
    range_end_ms: int | None,
    chunk_min: int,
    next_run_after: str | None,
    source: str,
) -> None:
    from clips_worker.decision_log import decision_log

    decision_log(
        "stream_import",
        "rolling_tick",
        vodId=vod_id,
        rangeStartMs=range_start_ms,
        rangeEndMs=range_end_ms,
        chunkMin=chunk_min,
        nextRunAfter=next_run_after,
        source=source,
    )


def cancel_queued_rolling_import_ticks(
    conn,
    *,
    project_id: str,
    vod_id: str,
) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET status='FAILED',
                error=LEFT(COALESCE(error, '') || ' Cancelled: rolling_stopped', 480),
                "finishedAt"=NOW(),
                "lockedBy"=NULL,
                "lockedAt"=NULL
            WHERE "projectId"=%s AND type='STREAM_IMPORT' AND status='QUEUED'
              AND payload->>'vodId'=%s
              AND payload ? 'rollingTick'
            RETURNING id
            """,
            (project_id, vod_id),
        )
        rows = cur.fetchall() or []
    conn.commit()
    return [str(r[0]) for r in rows]


def mark_rolling_pull_complete(conn, vod_id: str, end_ms: int) -> None:
    with conn.cursor() as cur:
        cur.execute('SELECT state FROM stream_vods WHERE id=%s', (vod_id,))
        row = cur.fetchone()
    if not row:
        return
    state = row[0] or {}
    if isinstance(state, str):
        state = json.loads(state)
    rolling = dict(state.get("rolling") or {})
    rolling["lastPulledMs"] = int(end_ms)
    rolling["lastPullCompletedAt"] = datetime.now(timezone.utc).isoformat()
    state = {**state, "rolling": rolling}
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE stream_vods SET state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
            (json.dumps(state), vod_id),
        )
    conn.commit()


def stop_rolling_session(conn, vod_id: str, *, reason: str, project_id: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT state, "projectId" FROM stream_vods WHERE id=%s',
            (vod_id,),
        )
        row = cur.fetchone()
    if not row:
        return
    state = row[0] or {}
    pid = project_id or str(row[1] or "")
    if isinstance(state, str):
        state = json.loads(state)
    rolling = dict(state.get("rolling") or {})
    rolling["live"] = False
    rolling["stoppedReason"] = reason[:120]
    rolling["stoppedAt"] = datetime.now(timezone.utc).isoformat()
    state = {**state, "rolling": rolling}
    cancelled: list[str] = []
    if pid:
        cancelled = cancel_queued_rolling_import_ticks(conn, project_id=pid, vod_id=vod_id)
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE stream_vods SET state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
            (json.dumps(state), vod_id),
        )
    conn.commit()
    from clips_worker.decision_log import decision_log

    decision_log(
        "stream_import",
        "rolling_stopped",
        vodId=vod_id,
        projectId=pid,
        reason=reason[:120],
        cancelled_job_ids=cancelled,
    )
    print(
        f"[clipper:autopull] rolling_stopped vodId={vod_id} reason={reason[:80]} "
        f"cancelledJobs={','.join(cancelled) if cancelled else 'none'}",
        flush=True,
    )
