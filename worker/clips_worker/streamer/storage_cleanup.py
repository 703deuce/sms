"""Delete bulky stream VOD artifacts; keep transcript, signals, and rank candidates."""
from __future__ import annotations

import json
import sys
import uuid
from psycopg2.extras import RealDictCursor

from clips_worker.storage import delete_object, object_byte_size
from clips_worker.streamer.bulk_keys import collect_bulky_stream_keys


def delete_storage_keys(keys: list[str], *, vod_id: str, reason: str) -> int:
    freed = 0
    deleted = 0
    for key in keys:
        try:
            nbytes = object_byte_size(key)
        except Exception:
            nbytes = 0
        try:
            delete_object(key)
            freed += nbytes
            deleted += 1
        except Exception as exc:
            print(
                f"[clipper:stream] cleanup_delete_failed vodId={vod_id} key={key} err={exc}",
                file=sys.stderr,
                flush=True,
            )
    print(
        f"[clipper:stream] cleanup_storage vodId={vod_id} reason={reason} "
        f"keysDeleted={deleted} bytesFreed={freed}",
        file=sys.stderr,
        flush=True,
    )
    return freed


def purge_stream_bulky_storage(conn, vod_id: str, *, reason: str = "success") -> int:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v."workspaceId", v.state, v."projectId"
            FROM stream_vods v
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        row = cur.fetchone()
    if not row:
        return 0
    workspace_id = str(row["workspaceId"])
    state = row["state"] or {}
    if isinstance(state, str):
        state = json.loads(state)
    project_id = row["projectId"]

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, "projectId", "sourceSegKey"
            FROM clips
            WHERE "projectId" = %s AND "deletedAt" IS NULL
            """,
            (project_id,),
        )
        clip_rows = [dict(r) for r in cur.fetchall()]

    keys = collect_bulky_stream_keys(
        workspace_id=workspace_id,
        vod_id=vod_id,
        state=state,
        clip_rows=clip_rows,
    )
    freed = delete_storage_keys(keys, vod_id=vod_id, reason=reason)

    # Drop bulky pointers from state; keep chunks.*.signalsKey, candidatesKey, ranking metadata.
    lean_chunks: dict = {}
    for idx, meta in (state.get("chunks") or {}).items():
        if not isinstance(meta, dict):
            continue
        keep = {}
        if meta.get("signalsKey"):
            keep["signalsKey"] = meta["signalsKey"]
        if keep:
            lean_chunks[str(idx)] = keep
    state.pop("audioKey", None)
    state.pop("chatKey", None)
    state.pop("analysisProxyKey", None)
    state.pop("localUploadKey", None)
    state.pop("frames", None)
    if lean_chunks:
        state["chunks"] = lean_chunks
    else:
        state.pop("chunks", None)
    state["bulkyStoragePurged"] = True

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clips SET "sourceSegKey" = NULL, "updatedAt" = NOW()
            WHERE "projectId" = %s AND "sourceSegKey" IS NOT NULL
            """,
            (project_id,),
        )
        cur.execute(
            """
            UPDATE stream_vods
            SET state = %s::jsonb, "sourceDeletedAt" = COALESCE("sourceDeletedAt", NOW()), "updatedAt" = NOW()
            WHERE id = %s
            """,
            (json.dumps(state), vod_id),
        )
    conn.commit()
    return freed


def enqueue_stream_cleanup_job(
    conn,
    project_id: str,
    vod_id: str,
    *,
    delay_hours: float = 0,
) -> str:
    job_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "runAfter", "createdAt")
            VALUES (%s,%s,'STREAM_CLEANUP','QUEUED',%s::jsonb,0,NOW() + (%s || ' hours')::interval,NOW())
            """,
            (job_id, project_id, json.dumps({"vodId": vod_id}), str(delay_hours)),
        )
    conn.commit()
    return job_id


def delete_clip_source_segment(
    workspace_id: str,
    project_id: str,
    clip_id: str,
    seg_key: str | None,
    *,
    vod_id: str,
) -> None:
    if not seg_key:
        return
    delete_storage_keys([seg_key], vod_id=vod_id, reason=f"segment_done clipId={clip_id}")
