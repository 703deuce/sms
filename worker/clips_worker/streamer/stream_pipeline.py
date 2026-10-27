"""Stream pipeline UX helpers (errors, retry visibility)."""
from __future__ import annotations


def clear_stream_vod_error(conn, vod_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE stream_vods SET error = NULL, "updatedAt" = NOW() WHERE id = %s AND error IS NOT NULL',
            (vod_id,),
        )
    conn.commit()


def user_retry_progress_payload(delay_s: int, message: str) -> dict:
    return {
        "jobStatus": "RUNNING",
        "projectStatus": "TRANSCRIBING",
        "stage": "retrying",
        "progress": 15,
        "error": f"Retrying in {delay_s}s: {message[:200]}",
    }
