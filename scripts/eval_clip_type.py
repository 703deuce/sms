#!/usr/bin/env python3
"""Read-only clip type audit for a project (T5.5)."""
from __future__ import annotations

import json
import os
import sys

from psycopg2.extras import RealDictCursor


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: eval_clip_type.py <project_id>", file=sys.stderr)
        return 2
    project_id = sys.argv[1]
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, title, "startMs", "endMs", "aiMeta"
            FROM clips
            WHERE "projectId" = %s
            ORDER BY "startMs"
            """,
            (project_id,),
        )
        rows = cur.fetchall()
    conn.close()
    for row in rows:
        meta = row["aiMeta"] if isinstance(row["aiMeta"], dict) else {}
        vm = meta.get("videoMoment") if isinstance(meta.get("videoMoment"), dict) else {}
        cls = meta.get("classify") if isinstance(meta.get("classify"), dict) else None
        print(
            json.dumps(
                {
                    "id": row["id"],
                    "title": (row["title"] or "")[:60],
                    "storedType": meta.get("clipType"),
                    "typeSource": meta.get("typeSource"),
                    "typeConf": meta.get("typeConf"),
                    "gui": vm.get("game_ui_visible"),
                    "cam": vm.get("real_camera_footage"),
                    "classifyMain": (cls or {}).get("main_picture"),
                    "classifyType": (cls or {}).get("clip_type"),
                }
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
