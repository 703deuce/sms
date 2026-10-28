"""Shared Modal transcribe circuit breaker (both worker containers mount the same cache dir)."""
from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

_MODAL_CIRCUIT_S = 600.0
_MODULE_UNTIL: float = 0.0


def _cache_path() -> Path:
    base = Path(os.environ.get("CLIPS_UPLOAD_STAGING_DIR") or "/opt/clips-worker/cache")
    return base / "modal_transcribe_circuit.json"


def modal_transcribe_circuit_open() -> bool:
    global _MODULE_UNTIL
    now = time.time()
    if now < _MODULE_UNTIL:
        return True
    path = _cache_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        until = float(data.get("open_until") or 0)
        _MODULE_UNTIL = until
        return now < until
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return False


def record_modal_transcribe_timeout() -> None:
    global _MODULE_UNTIL
    until = time.time() + _MODAL_CIRCUIT_S
    _MODULE_UNTIL = until
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"open_until": until, "updated_at": time.time()}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload), encoding="utf-8")
    os.replace(tmp, path)
    from clips_worker.decision_log import decision_log

    decision_log(
        "streamer",
        "modal_transcribe_circuit",
        open_until_s=round(until, 3),
        cooldown_s=int(_MODAL_CIRCUIT_S),
        store=str(path),
    )


def modal_circuit_remaining_s() -> float:
    if not modal_transcribe_circuit_open():
        return 0.0
    return max(0.0, _MODULE_UNTIL - time.time())
