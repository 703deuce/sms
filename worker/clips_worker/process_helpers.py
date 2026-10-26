"""PROCESS_PROJECT payload / transcript helpers (import-safe for unit tests)."""
from __future__ import annotations

import json


def job_payload(job: dict) -> dict:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    return payload if isinstance(payload, dict) else {}


def stored_transcript_words(project: dict) -> list[dict] | None:
    tw = project.get("transcriptWords")
    if not tw:
        return None
    if isinstance(tw, str):
        tw = json.loads(tw)
    if isinstance(tw, list) and tw:
        return tw
    return None
