"""Patch clip.edits sub-keys without clobbering the full JSON blob."""
from __future__ import annotations

import json


def patch_clip_edits_json_path(conn, clip_id: str, path: list[str], value: object) -> None:
    if not path:
        raise ValueError("path required")
    path_sql = "{" + ",".join(path) + "}"
    payload = json.dumps(value)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clips
            SET edits = jsonb_set(COALESCE(edits, '{}'::jsonb), %s::text[], %s::jsonb, true),
                "editsSaveVersion" = COALESCE("editsSaveVersion", 0) + 1,
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (path_sql, payload, clip_id),
        )
    conn.commit()
