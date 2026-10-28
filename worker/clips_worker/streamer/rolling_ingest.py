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


def log_chunk_min_source(*, vod_id: str, chunk_min: int, source: str) -> None:
    from clips_worker.decision_log import decision_log

    decision_log(
        "stream_import",
        "chunk_min_source",
        vodId=vod_id,
        chunkMin=chunk_min,
        source=source[:80],
    )


def seed_rolling_chunk_min(
    state: dict,
    *,
    vod_id: str,
    range_start_ms: int,
    range_end_ms: int,
    channel_chunk_min: int | None = None,
) -> dict:
    """Seed state.rolling.chunkMin from paste range unless channel override."""
    rolling = dict(state.get("rolling") if isinstance(state.get("rolling"), dict) else {})
    if channel_chunk_min is not None:
        rolling["chunkMin"] = max(3, min(60, int(channel_chunk_min)))
        rolling["chunkMinSource"] = "channel_settings"
        state = {**state, "rolling": rolling}
        log_chunk_min_source(
            vod_id=vod_id,
            chunk_min=int(rolling["chunkMin"]),
            source="channel_settings",
        )
        return state
    elif rolling.get("chunkMin") is None and range_end_ms > range_start_ms:
        span_ms = range_end_ms - range_start_ms
        rolling["chunkMin"] = max(3, min(60, int((span_ms + 59_999) // 60_000)))
        rolling["chunkMinSource"] = str(rolling.get("chunkMinSource") or "paste_range_span")
        state = {**state, "rolling": rolling}
        log_chunk_min_source(
            vod_id=vod_id,
            chunk_min=int(rolling["chunkMin"]),
            source=str(rolling.get("chunkMinSource") or "unknown"),
        )
        return state
    state = {**state, "rolling": rolling}
    return state


def rolling_pull_overlap_ms() -> int:
    """Max overlap between consecutive rolling windows (analyze continuity)."""
    return min(30_000, max(0, _int("STREAMER_ROLLING_OVERLAP_MS", 30_000)))


def rolling_min_new_ms_for_state(state: dict) -> int:
    chunk_ms = rolling_chunk_min(state) * 60_000
    default = _int("STREAMER_ROLLING_MIN_NEW_MS", 45_000)
    return min(default, max(15_000, chunk_ms // 6))


def rolling_max_window_ms() -> int:
    return _int("STREAMER_ROLLING_MAX_WINDOW_MS", 15 * 60 * 1000)


def resolve_rolling_max_session_hours(state: dict | None) -> tuple[int, str]:
    """
    Wall-clock cap for this rolling auto-pull session.
    Channel settings (copied to state.rolling.maxSessionHours) override env default (6h).
    """
    st = state if isinstance(state, dict) else {}
    rolling = st.get("rolling") if isinstance(st.get("rolling"), dict) else {}
    if "maxSessionHours" in rolling and rolling.get("maxSessionHours") is not None:
        try:
            v = int(rolling.get("maxSessionHours") or 0)
        except (TypeError, ValueError):
            v = 0
        if v > 0:
            return min(168, v), "channel_settings"
    return _int("STREAMER_ROLLING_MAX_SESSION_HOURS", 6), "env_default"


def rolling_limits_snapshot(state: dict | None) -> dict[str, Any]:
    st = state if isinstance(state, dict) else {}
    rolling = st.get("rolling") if isinstance(st.get("rolling"), dict) else {}
    cap_h, cap_src = resolve_rolling_max_session_hours(st)
    chunk_min = rolling_chunk_min(st)
    return {
        "chunkMin": chunk_min,
        "chunkMinSource": str(rolling.get("chunkMinSource") or "env_or_default"),
        "overlapMs": rolling_pull_overlap_ms(),
        "overlapSource": "env_STREAMER_ROLLING_OVERLAP_MS",
        "minNewMs": rolling_min_new_ms_for_state(st),
        "minNewSource": "env_STREAMER_ROLLING_MIN_NEW_MS_scaled",
        "maxWindowMs": rolling_max_window_ms(),
        "maxWindowSource": "env_STREAMER_ROLLING_MAX_WINDOW_MS",
        "maxSessionHours": cap_h,
        "maxSessionHoursSource": cap_src,
    }


def rolling_max_session_hours(state: dict | None = None) -> int:
    cap, _ = resolve_rolling_max_session_hours(state)
    return cap


def rolling_min_new_ms() -> int:
    return _int("STREAMER_ROLLING_MIN_NEW_MS", 45_000)


def anchor_rolling_session_started_at(rolling: dict, *, seed: bool) -> tuple[dict, str | None, bool]:
    """
    Session cap clock uses ONLY rolling.sessionStartedAt (first pull of this session).
    Never infer from stream start, archive offset, or lastPull* timestamps.
    """
    r = dict(rolling or {})
    existing = r.get("sessionStartedAt")
    if existing:
        return r, str(existing), False
    if not seed:
        return r, None, False
    now = datetime.now(timezone.utc).isoformat()
    r["sessionStartedAt"] = now
    return r, now, True


def rolling_session_elapsed_hours(
    rolling: dict,
    *,
    seed_if_missing: bool = False,
) -> tuple[float, str | None, dict, bool]:
    rolling, session_started_at, mutated = anchor_rolling_session_started_at(
        rolling,
        seed=seed_if_missing,
    )
    if not session_started_at:
        return 0.0, None, rolling, mutated
    try:
        started = datetime.fromisoformat(str(session_started_at).replace("Z", "+00:00"))
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed_h = (datetime.now(timezone.utc) - started).total_seconds() / 3600.0
    except (TypeError, ValueError):
        elapsed_h = 0.0
    return elapsed_h, session_started_at, rolling, mutated


def emit_rolling_session_check(
    *,
    vod_id: str | None,
    state: dict | None,
    seed_if_missing: bool = False,
) -> tuple[float, int, dict, bool]:
    """Log rolling_session_check; optionally seed sessionStartedAt (first pull only)."""
    from clips_worker.decision_log import decision_log

    st = state if isinstance(state, dict) else {}
    rolling = dict(st.get("rolling") if isinstance(st.get("rolling"), dict) else {})
    elapsed_h, session_started_at, rolling, mutated = rolling_session_elapsed_hours(
        rolling,
        seed_if_missing=seed_if_missing,
    )
    cap_h, cap_src = resolve_rolling_max_session_hours({**st, "rolling": rolling})
    decision_log(
        "stream_import",
        "rolling_session_check",
        vodId=vod_id or "",
        elapsed_h=round(elapsed_h, 4),
        cap_h=cap_h,
        cap_source=cap_src,
        sessionStartedAt=session_started_at or "",
    )
    return elapsed_h, cap_h, rolling, mutated


def plan_rolling_window_ms(
    *,
    total_vod_ms: int,
    state: dict,
    finalize: bool,
    vod_id: str | None = None,
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

    elapsed_h, cap_h, rolling, session_mutated = emit_rolling_session_check(
        vod_id=vod_id,
        state=state,
        seed_if_missing=True,
    )
    if session_mutated:
        state["rolling"] = {**(state.get("rolling") if isinstance(state.get("rolling"), dict) else {}), **rolling}
    if elapsed_h > cap_h:
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
    plan = plan_rolling_window_ms(
        total_vod_ms=total_vod_ms,
        state=state,
        finalize=finalize,
        vod_id=str(vod.get("id") or ""),
    )
    if plan is None or plan == "stop_session":
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE stream_vods SET state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
                (json.dumps(state), vod["id"]),
            )
        conn.commit()
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
        state=state,
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
    state: dict | None = None,
) -> None:
    from clips_worker.decision_log import decision_log

    limits = rolling_limits_snapshot(state)
    decision_log(
        "stream_import",
        "rolling_tick",
        vodId=vod_id,
        rangeStartMs=range_start_ms,
        rangeEndMs=range_end_ms,
        chunkMin=chunk_min,
        nextRunAfter=next_run_after,
        source=source,
        **limits,
    )
    emit_rolling_session_check(vod_id=vod_id, state=state, seed_if_missing=False)


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
    rolling = dict(state.get("rolling") or {})
    emit_rolling_session_check(vod_id=vod_id, state=state, seed_if_missing=False)
    print(
        f"[clipper:autopull] rolling_stopped vodId={vod_id} reason={reason[:80]} "
        f"cancelledJobs={','.join(cancelled) if cancelled else 'none'}",
        flush=True,
    )
