"""Patch T2vDraft.document from worker jobs."""
from __future__ import annotations

import json
import time
from typing import Any


def patch_scene_media(
    conn,
    *,
    workspace_id: str,
    draft_id: str,
    scene_id: str,
    media: dict[str, Any],
) -> None:
    last_err: Exception | None = None
    for attempt in range(5):
        try:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT document, revision FROM t2v_drafts WHERE id=%s AND "workspaceId"=%s',
                    (draft_id, workspace_id),
                )
                row = cur.fetchone()
                if not row:
                    raise RuntimeError("draft_not_found")
                doc, revision = row
                if isinstance(doc, str):
                    doc = json.loads(doc)
                scenes = doc.get("scenes") or []
                idx = next((i for i, s in enumerate(scenes) if s.get("id") == scene_id), -1)
                if idx < 0:
                    raise RuntimeError("scene_not_found")
                scenes[idx] = {**scenes[idx], "media": {**media, "locked": True}}
                doc["scenes"] = scenes
                cur.execute(
                    """
                    UPDATE t2v_drafts
                    SET document=%s::jsonb, revision=revision+1, "updatedAt"=NOW()
                    WHERE id=%s AND "workspaceId"=%s AND revision=%s
                    """,
                    (json.dumps(doc), draft_id, workspace_id, revision),
                )
                if cur.rowcount != 1:
                    raise RuntimeError("draft_revision_conflict")
            conn.commit()
            return
        except RuntimeError as exc:
            last_err = exc
            conn.rollback()
            if "draft_revision_conflict" not in str(exc) or attempt >= 4:
                raise
            time.sleep(0.05 * (attempt + 1))
    if last_err:
        raise last_err
