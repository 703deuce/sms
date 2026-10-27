"""S3 stream-hour metering and workspace caps."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from clips_worker.streamer.config import DEFAULT_MONTHLY_HOURS


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()


def _streamer_limits(conn, workspace_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT limits FROM workspace_limits WHERE "workspaceId" = %s LIMIT 1
            """,
            (workspace_id,),
        )
        row = cur.fetchone()
    if not row or not row[0]:
        return {}
    limits = row[0]
    if isinstance(limits, str):
        limits = json.loads(limits)
    return (limits or {}).get("streamer") or {}


def monthly_cap_hours(conn, workspace_id: str) -> float | None:
    lim = _streamer_limits(conn, workspace_id)
    raw = lim.get("monthlyHours")
    if raw is None:
        return DEFAULT_MONTHLY_HOURS
    if raw == 0:
        return None
    return float(raw)


def used_seconds_this_month(conn, workspace_id: str) -> int:
    period = _month_start()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE("sourceSeconds", 0) FROM stream_usage
            WHERE "workspaceId" = %s AND "periodStart" = %s
            """,
            (workspace_id, period),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0


def check_cap(conn, workspace_id: str, incoming_seconds: int) -> str | None:
    cap_h = monthly_cap_hours(conn, workspace_id)
    if cap_h is None:
        return None
    used = used_seconds_this_month(conn, workspace_id)
    cap_s = int(cap_h * 3600)
    if used + incoming_seconds > cap_s:
        return f"Monthly stream-hour cap reached ({used / 3600:.1f} / {cap_h:.0f} h)"
    return None


def check_cap_code(conn, workspace_id: str, incoming_seconds: int) -> str | None:
    """Returns 'stream_cap' when blocked (for job handlers / UI)."""
    if check_cap(conn, workspace_id, incoming_seconds):
        return "stream_cap"
    return None


def _add_usage_seconds(
    conn,
    workspace_id: str,
    *,
    source_seconds: int = 0,
    idle_skipped_seconds: int = 0,
    vod_delta: int = 0,
) -> None:
    period = _month_start()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stream_usage (
              id, "workspaceId", "periodStart", "sourceSeconds", "idleSkippedSeconds", "vodCount", "updatedAt"
            )
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT ("workspaceId", "periodStart") DO UPDATE
              SET "sourceSeconds" = stream_usage."sourceSeconds" + EXCLUDED."sourceSeconds",
                  "idleSkippedSeconds" = stream_usage."idleSkippedSeconds" + EXCLUDED."idleSkippedSeconds",
                  "vodCount" = stream_usage."vodCount" + EXCLUDED."vodCount",
                  "updatedAt" = NOW()
            """,
            (
                f"su_{uuid.uuid4().hex[:24]}",
                workspace_id,
                period,
                source_seconds,
                idle_skipped_seconds,
                vod_delta,
            ),
        )


def meter_vod_once(conn, workspace_id: str, vod_id: str, analysed_seconds: int, state: dict) -> dict:
    if state.get("metered"):
        return state
    _add_usage_seconds(conn, workspace_id, source_seconds=analysed_seconds, vod_delta=1)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_vods SET state = jsonb_set(COALESCE(state, '{}'::jsonb), '{metered}', 'true'::jsonb)
            WHERE id = %s
            """,
            (vod_id,),
        )
    conn.commit()
    state = {**state, "metered": True}
    return state


def meter_chunk_once(
    conn,
    workspace_id: str,
    vod_id: str,
    chunk_index: int,
    processed_seconds: int,
    state: dict,
    *,
    idle_skipped_seconds: int = 0,
) -> dict:
    """Marathon rolling: meter each transcribed chunk; idle skipped does not add to sourceSeconds."""
    metered = state.get("meteredChunks") or []
    if isinstance(metered, list) and chunk_index in metered:
        return state
    if processed_seconds > 0 or idle_skipped_seconds > 0:
        _add_usage_seconds(
            conn,
            workspace_id,
            source_seconds=max(0, processed_seconds),
            idle_skipped_seconds=max(0, idle_skipped_seconds),
            vod_delta=0,
        )
    metered_list = list(metered) if isinstance(metered, list) else []
    if chunk_index not in metered_list:
        metered_list.append(chunk_index)
    state = {**state, "meteredChunks": metered_list}
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_vods SET state = %s::jsonb, "updatedAt"=NOW() WHERE id = %s
            """,
            (json.dumps(state), vod_id),
        )
    conn.commit()
    return state


def job_priority(conn, workspace_id: str, triggered_by: str) -> int:
    lim = _streamer_limits(conn, workspace_id)
    base = int(lim.get("priority") or 0)
    if triggered_by == "paste":
        return base + 5
    return base
