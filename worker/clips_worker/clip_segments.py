"""Stable segment identity per project (recovery / retry idempotency)."""
from __future__ import annotations

from typing import Any


def clip_segment_key(start_ms: int, end_ms: int) -> str:
    return f"{int(start_ms)}:{int(end_ms)}"


def span_overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    overlap = max(0, min(a1, b1) - max(a0, b0))
    span = max(1, min(a1 - a0, b1 - b0))
    return overlap / span


def spans_same_segment(a0: int, a1: int, b0: int, b1: int, *, near_match_ratio: float = 0.85) -> bool:
    """Same persisted segment identity, or near-identical span after snap drift."""
    if clip_segment_key(a0, a1) == clip_segment_key(b0, b1):
        return True
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
