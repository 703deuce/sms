"""Metadata when speakercrop is replaced by ffmpeg fit export."""
from __future__ import annotations

import json

RENDER_FORMAT_FIT_FALLBACK = "mp4+fit_fallback"
RENDER_FORMAT_DEFAULT = "mp4"


def merge_job_fit_fallback_payload(conn, job_id: str, speakercrop_tail: str) -> None:
    patch = {
        "fitFallback": True,
        "speakercropTail": (speakercrop_tail or "")[:2000],
    }
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE clip_jobs SET payload = COALESCE(payload, \'{}\'::jsonb) || %s::jsonb WHERE id = %s',
            (json.dumps(patch), job_id),
        )
    conn.commit()
