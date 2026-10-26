"""STREAM_CLEANUP: delete bulky stream sources; keep segments and clip outputs."""
from __future__ import annotations

import json

from clips_worker.storage import delete_object
from clips_worker.streamer.keys import stream_audio_key, stream_chunk_key, stream_signals_key


def run_stream_cleanup_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    with conn.cursor() as cur:
        cur.execute(
            'SELECT "workspaceId", state, "signalsKey" FROM stream_vods WHERE id = %s',
            (vod_id,),
        )
        row = cur.fetchone()
    if not row:
        return
    workspace_id, state, signals_key = row[0], row[1] or {}, row[2]
    if isinstance(state, str):
        state = json.loads(state)

    keys = [stream_audio_key(workspace_id, vod_id)]
    chunks = state.get("chunks") or {}
    for idx in chunks:
        keys.append(stream_chunk_key(workspace_id, vod_id, int(idx), "opus"))
        wk = chunks[idx].get("wordsKey")
        if wk:
            keys.append(wk)
    if state.get("chatKey"):
        keys.append(state["chatKey"])

    for key in keys:
        try:
            delete_object(key)
        except Exception:
            pass

    with conn.cursor() as cur:
        cur.execute(
            'UPDATE stream_vods SET "sourceDeletedAt" = NOW(), "updatedAt" = NOW() WHERE id = %s',
            (vod_id,),
        )
    conn.commit()
    post_progress(job["id"], {"jobStatus": "DONE"})
