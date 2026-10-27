"""Stable segment identity per project (recovery / retry idempotency)."""
from __future__ import annotations

from typing import Any


def clip_segment_key(start_ms: int, end_ms: int) -> str:
    return f"{int(start_ms)}:{int(end_ms)}"


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
