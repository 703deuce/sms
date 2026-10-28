"""Structured clip pipeline decision log (console + job payload)."""
from __future__ import annotations

import json
import re
import threading
import time
from typing import Any

from clips_worker.stage_log import sanitize_log_text

MAX_DECISION_LOG_ENTRIES = 400
MAX_RECORD_CHARS = 8192
MAX_RAW_JSON_CHARS = 6144
_PERSIST_EVERY_N = 8
_PERSIST_MIN_INTERVAL_S = 2.0

_REDACT_VALUE = re.compile(
    r"(?i)(signed|signature|token|secret|password|authorization|api[_-]?key|x-goog-|aws4-hmac)"
)

_ctx_lock = threading.Lock()
_conn: Any = None
_job_id: str | None = None
_buffer: list[dict[str, Any]] = []
_persisted_count = 0
_since_persist = 0
_last_persist_mono = 0.0


def bind_decision_log(conn, job_id: str | None) -> None:
    global _conn, _job_id, _buffer, _persisted_count, _since_persist, _last_persist_mono
    with _ctx_lock:
        _conn = conn
        _job_id = (job_id or "").strip() or None
        _buffer = []
        _persisted_count = 0
        _since_persist = 0
        _last_persist_mono = 0.0


def unbind_decision_log() -> None:
    flush_decision_log(force=True)
    bind_decision_log(None, None)


def _sanitize_value(val: Any, *, depth: int = 0) -> Any:
    if depth > 6:
        return "(nested)"
    if val is None or isinstance(val, (bool, int, float)):
        return val
    if isinstance(val, str):
        if _REDACT_VALUE.search(val):
            return "(redacted)"
        return sanitize_log_text(val)
    if isinstance(val, (list, tuple)):
        return [_sanitize_value(v, depth=depth + 1) for v in val[:200]]
    if isinstance(val, dict):
        out: dict[str, Any] = {}
        for k, v in list(val.items())[:80]:
            sk = str(k)
            if _REDACT_VALUE.search(sk):
                out[sk] = "(redacted)"
            else:
                out[sk] = _sanitize_value(v, depth=depth + 1)
        return out
    return sanitize_log_text(str(val)[:500])


def _truncate_record(rec: dict[str, Any]) -> dict[str, Any]:
    raw = json.dumps(rec, default=str, ensure_ascii=False)
    if len(raw) <= MAX_RECORD_CHARS:
        return rec
    slim = dict(rec)
    for key in ("rawModelJson", "raw_json", "modelJson", "priorMoment"):
        if key in slim and isinstance(slim[key], str) and len(slim[key]) > 2000:
            slim[key] = slim[key][:2000] + "…"
    raw2 = json.dumps(slim, default=str, ensure_ascii=False)
    if len(raw2) > MAX_RECORD_CHARS:
        slim["_truncated"] = True
        slim["_preview"] = raw2[: MAX_RECORD_CHARS - 64] + "…"
        for k in list(slim.keys()):
            if k not in ("stage", "event", "_truncated", "_preview"):
                del slim[k]
    return slim


def sanitize_model_json(data: Any) -> str:
    """Sections + moments JSON for decision log (~6KB cap)."""
    try:
        if isinstance(data, str):
            text = sanitize_log_text(data)
        else:
            text = json.dumps(_sanitize_value(data), default=str, ensure_ascii=False)
    except Exception:
        text = sanitize_log_text(str(data)[:MAX_RAW_JSON_CHARS])
    if len(text) > MAX_RAW_JSON_CHARS:
        return text[:MAX_RAW_JSON_CHARS] + "…"
    return text


def decision_log(stage: str, event: str, **fields: Any) -> None:
    rec: dict[str, Any] = {
        "ts": round(time.time(), 3),
        "stage": str(stage),
        "event": str(event),
    }
    for k, v in fields.items():
        if v is None:
            continue
        rec[str(k)] = _sanitize_value(v)
    rec = _truncate_record(rec)
    line = json.dumps(rec, default=str, ensure_ascii=False)
    print(f"[clipper:decision] {line}", flush=True)

    with _ctx_lock:
        _buffer.append(rec)
        if len(_buffer) > MAX_DECISION_LOG_ENTRIES:
            _buffer[:] = _buffer[-MAX_DECISION_LOG_ENTRIES:]
        global _since_persist
        _since_persist += 1
        _maybe_persist_locked()


def _maybe_persist_locked(force: bool = False) -> None:
    global _since_persist, _last_persist_mono, _persisted_count
    if not _conn or not _job_id:
        return
    now = time.monotonic()
    if not force and _since_persist < _PERSIST_EVERY_N and (now - _last_persist_mono) < _PERSIST_MIN_INTERVAL_S:
        return
    from clips_worker.picker_checkpoint import merge_job_payload

    merge_job_payload(_conn, _job_id, {"decisionLog": list(_buffer)})
    _persisted_count = len(_buffer)
    _since_persist = 0
    _last_persist_mono = now


def flush_decision_log(*, force: bool = False) -> None:
    with _ctx_lock:
        _maybe_persist_locked(force=force)


def decision_log_snapshot() -> list[dict[str, Any]]:
    with _ctx_lock:
        return list(_buffer)
