"""Persist picker pass1/pass2 on the job payload so requeued PROCESS_PROJECT jobs can resume."""
from __future__ import annotations

import json
from typing import Any

import psycopg2


def _cache_key(settings: dict[str, Any], range_start_ms: int, range_end_ms: int) -> dict[str, Any]:
    return {
        "genre": settings.get("genre", "podcast"),
        "prompt": (settings.get("prompt") or "").strip(),
        "clipLength": settings.get("clipLength") or settings.get("clip_length") or "auto",
        "rangeStartMs": int(range_start_ms),
        "rangeEndMs": int(range_end_ms),
    }


def load_picker_cache(payload: dict[str, Any], settings: dict[str, Any], range_start_ms: int, range_end_ms: int) -> dict[str, Any]:
    raw = payload.get("pickerCache")
    if not isinstance(raw, dict):
        return {}
    if raw.get("key") != _cache_key(settings, range_start_ms, range_end_ms):
        return {}
    return raw


def merge_job_payload(conn, job_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute('SELECT payload FROM clip_jobs WHERE id = %s', (job_id,))
        row = cur.fetchone()
        payload: dict[str, Any] = {}
        if row and row[0]:
            if isinstance(row[0], str):
                payload = json.loads(row[0])
            elif isinstance(row[0], dict):
                payload = dict(row[0])
        payload.update(patch)
        cur.execute(
            'UPDATE clip_jobs SET payload = %s::jsonb WHERE id = %s',
            (json.dumps(payload), job_id),
        )
    conn.commit()
    return payload


def save_picker_cache(
    conn,
    job_id: str,
    payload: dict[str, Any],
    settings: dict[str, Any],
    range_start_ms: int,
    range_end_ms: int,
    *,
    moments: list[dict] | None = None,
    scored: list[dict] | None = None,
) -> dict[str, Any]:
    cache = dict(payload.get("pickerCache") or {})
    cache["key"] = _cache_key(settings, range_start_ms, range_end_ms)
    if moments is not None:
        cache["pass1Moments"] = moments
    if scored is not None:
        cache["pass2Scored"] = scored
    return merge_job_payload(
        conn,
        job_id,
        {"pickerCache": cache, "resume": True},
    )
