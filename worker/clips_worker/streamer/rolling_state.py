"""Rolling pull cursor helpers (avoid stale in-memory state clobbering DB commits)."""
from __future__ import annotations

import json


def read_rolling_last_pulled_ms(conn, vod_id: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT (state->'rolling'->>'lastPulledMs')::bigint FROM stream_vods WHERE id=%s""",
            (vod_id,),
        )
        row = cur.fetchone()
    if not row or row[0] is None:
        return 0
    try:
        return int(row[0])
    except (TypeError, ValueError):
        return 0


def merge_rolling_last_pulled_ms(*, committed_ms: int, window_end_ms: int) -> int:
    return max(int(committed_ms), int(window_end_ms))


def reload_vod_state_dict(conn, vod_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute('SELECT state FROM stream_vods WHERE id=%s', (vod_id,))
        row = cur.fetchone()
    if not row or not row[0]:
        return {}
    state = row[0]
    if isinstance(state, str):
        state = json.loads(state) if state else {}
    return state if isinstance(state, dict) else {}
