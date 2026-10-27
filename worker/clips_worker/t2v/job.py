"""T2V_ASSEMBLE worker job — M0 registers the type; M3 implements assembly."""
from __future__ import annotations


def run_t2v_assemble_job(conn, job: dict, progress) -> None:
    progress(
        job["id"],
        {"jobStatus": "RUNNING", "stage": "assemble", "progress": 0},
    )
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        import json

        payload = json.loads(payload)
    draft_id = payload.get("draftId")
    if draft_id:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE t2v_drafts
                SET status = %s, stage = %s, error = %s, "updatedAt" = NOW()
                WHERE id = %s
                """,
                ("FAILED", "failed", "T2V assemble not implemented (M3)", draft_id),
            )
        conn.commit()
    raise RuntimeError("T2V_ASSEMBLE ships in milestone M3")
