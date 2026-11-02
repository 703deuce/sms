"""Export finished with optional user-visible warnings (EF-24 bg removal skip)."""
from __future__ import annotations

import json


def merge_job_export_warnings(conn, job_id: str, warnings: list[str]) -> None:
    clean = [str(w) for w in warnings if w]
    if not clean:
        return
    patch = {"warnings": clean}
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE clip_jobs SET payload = COALESCE(payload, \'{}\'::jsonb) || %s::jsonb WHERE id = %s',
            (json.dumps(patch), job_id),
        )
    conn.commit()
