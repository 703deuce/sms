"""Stable segment identity per project (recovery / retry idempotency)."""
from __future__ import annotations

from typing import Any

from clips_worker.overlap_policy import (
    HEADSTART_SPAN_MATCH_MS,
    span_overlap_ratio,
    spans_match_planned_render,
)



def clip_segment_key(start_ms: int, end_ms: int) -> str:
    return f"{int(start_ms)}:{int(end_ms)}"


def spans_same_segment(
    a0: int,
    a1: int,
    b0: int,
    b1: int,
    *,
    near_match_ratio: float | None = None,
) -> bool:
    """Exact segment key, or near-identical span (legacy snap drift only)."""
    if clip_segment_key(a0, a1) == clip_segment_key(b0, b1):
        return True
    if near_match_ratio is None:
        return spans_match_planned_render(a0, a1, b0, b1, tol_ms=HEADSTART_SPAN_MATCH_MS)
    return span_overlap_ratio(a0, a1, b0, b1) >= near_match_ratio


def span_tuple(start_ms: int, end_ms: int) -> tuple[int, int]:
    return (int(start_ms), int(end_ms))


def load_project_segment_spans(conn, project_id: str) -> set[tuple[int, int]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "startMs", "endMs"
            FROM clips
            WHERE "projectId" = %s AND "deletedAt" IS NULL
            """,
            (project_id,),
        )
        rows = cur.fetchall()
    return {span_tuple(r[0], r[1]) for r in rows}


def load_project_segments_with_preview(conn, project_id: str) -> set[tuple[int, int]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "startMs", "endMs"
            FROM clips
            WHERE "projectId" = %s AND "deletedAt" IS NULL AND "previewKey" IS NOT NULL
            """,
            (project_id,),
        )
        rows = cur.fetchall()
    return {span_tuple(r[0], r[1]) for r in rows}


def row_segment_key(row: dict[str, Any]) -> str:
    return clip_segment_key(int(row["startMs"]), int(row["endMs"]))
