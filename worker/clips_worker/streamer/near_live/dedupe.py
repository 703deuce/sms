"""Cross-chunk near-live dedupe: soft-delete overlapping clips (keep best score)."""
from __future__ import annotations

from clips_worker.streamer.fusion import _iou


def dedupe_project_clips(conn, project_id: str, iou_threshold: float = 0.3) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "startMs", "endMs", score
            FROM clips
            WHERE "projectId"=%s AND "deletedAt" IS NULL
            ORDER BY score DESC
            """,
            (project_id,),
        )
        rows = cur.fetchall()
    kept: list[tuple] = []
    remove_ids: list[str] = []
    for row in rows:
        cid, s0, s1, _score = row
        if any(_iou(s0, s1, k[1], k[2]) > iou_threshold for k in kept):
            remove_ids.append(cid)
            continue
        kept.append((cid, s0, s1))
    if not remove_ids:
        return 0
    with conn.cursor() as cur:
        for cid in remove_ids:
            cur.execute('UPDATE clips SET "deletedAt"=NOW(), "updatedAt"=NOW() WHERE id=%s', (cid,))
    conn.commit()
    return len(remove_ids)
