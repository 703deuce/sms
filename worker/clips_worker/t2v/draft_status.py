"""Mirror T2V_ASSEMBLE job progress onto t2v_drafts."""
from __future__ import annotations

import json


def _payload(job: dict) -> dict:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    return payload or {}


def update_t2v_draft_for_job(
    conn,
    job: dict,
    *,
    status: str | None = None,
    stage: str | None = None,
    progress: int | None = None,
    error: str | None = None,
    clear_error: bool = False,
) -> None:
    if job.get("type") != "T2V_ASSEMBLE":
        return
    draft_id = _payload(job).get("draftId")
    if not draft_id:
        return
    sets: list[str] = ['"updatedAt"=NOW()']
    vals: list[object] = []
    if status is not None:
        sets.append("status=%s")
        vals.append(status)
    if stage is not None:
        sets.append("stage=%s")
        vals.append(stage)
    if progress is not None:
        sets.append("progress=%s")
        vals.append(int(progress))
    if clear_error:
        sets.append("error=NULL")
    elif error is not None:
        sets.append("error=%s")
        vals.append(str(error)[:4000])
    if len(sets) == 1:
        return
    sql = f'UPDATE t2v_drafts SET {", ".join(sets)} WHERE id=%s'
    vals.append(draft_id)
    with conn.cursor() as cur:
        cur.execute(sql, tuple(vals))


def mark_t2v_assemble_failed(conn, job: dict, message: str) -> None:
    update_t2v_draft_for_job(
        conn,
        job,
        status="DRAFT",
        stage="failed",
        progress=0,
        error=message[:4000],
    )
