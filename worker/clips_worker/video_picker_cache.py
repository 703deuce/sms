"""Cache Gemini video-picker output per VOD slice (avoid re-pay on job retry)."""
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path
from typing import Any

from clips_worker.storage import download_object, put_json

VP_CACHE_SCHEMA = 2


def _cache_key(workspace_id: str, vod_id: str, range_start_ms: int, range_end_ms: int) -> str:
    span = f"{int(range_start_ms)}-{int(range_end_ms)}"
    h = hashlib.sha256(f"{VP_CACHE_SCHEMA}:{span}".encode()).hexdigest()[:16]
    return f"clips/stream/{workspace_id}/vod/{vod_id}/video_picker/{h}.json"


def load_video_picker_cache(
    workspace_id: str,
    vod_id: str,
    range_start_ms: int,
    range_end_ms: int,
) -> dict[str, Any] | None:
    key = _cache_key(workspace_id, vod_id, range_start_ms, range_end_ms)
    try:
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tpath = Path(tmp.name)
        download_object(key, tpath)
        raw = json.loads(tpath.read_text())
        tpath.unlink(missing_ok=True)
    except Exception as exc:
        from clips_worker.decision_log import decision_log

        decision_log(
            "video_picker_cache",
            "miss",
            key=key[-48:],
            reason=type(exc).__name__,
        )
        return None
    if not isinstance(raw, dict) or raw.get("v") != VP_CACHE_SCHEMA:
        return None
    return raw


def save_video_picker_cache(
    workspace_id: str,
    vod_id: str,
    range_start_ms: int,
    range_end_ms: int,
    *,
    moments: list[dict],
    curve: list[float],
    meta: dict[str, Any],
) -> str:
    key = _cache_key(workspace_id, vod_id, range_start_ms, range_end_ms)
    payload = {
        "v": VP_CACHE_SCHEMA,
        "rangeStartMs": int(range_start_ms),
        "rangeEndMs": int(range_end_ms),
        "moments": moments,
        "curve": curve,
        "meta": meta,
    }
    put_json(key, payload)
    return key
