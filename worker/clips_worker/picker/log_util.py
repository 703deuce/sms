"""Structured INFO logging for the clip picker pipeline."""
from __future__ import annotations

import json
import logging

logger = logging.getLogger("clips_worker.picker")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def picker_info(event: str, **fields: object) -> None:
    payload = {"picker": event, **fields}
    logger.info(json.dumps(payload, default=str))


def json_snippet(obj: object, limit: int = 2000) -> str:
    raw = json.dumps(obj, default=str)
    if len(raw) <= limit:
        return raw
    return raw[:limit] + "…"
