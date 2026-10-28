"""Persist picker/gpu telemetry into clip_jobs.payload.pickerCache (survives worker restarts)."""
from __future__ import annotations

import json
from contextvars import ContextVar
from typing import Any, Callable

import psycopg2

from clips_worker.picker_checkpoint import merge_job_payload

_telemetry_sink: ContextVar[Callable[[str, dict[str, Any]], None] | None] = ContextVar(
    "job_telemetry_sink",
    default=None,
)


def bind_job_telemetry(sink: Callable[[str, dict[str, Any]], None] | None) -> None:
    _telemetry_sink.set(sink)


def _emit(kind: str, data: dict[str, Any]) -> None:
    sink = _telemetry_sink.get()
    if sink is not None:
        sink(kind, data)


def record_video_picker_stats(
    meta: dict[str, Any],
    moments: list[dict],
    *,
    range_start_ms: int = 0,
    sections: list[dict] | None = None,
) -> None:
    ts: list[float] = []
    summaries: list[dict[str, Any]] = []
    for m in moments[:48]:
        try:
            peak = float(m.get("peak_s") or m.get("t_s") or 0)
            if m.get("peak_ms") is not None:
                peak = (int(m["peak_ms"]) - range_start_ms) / 1000.0
            ts.append(round(peak, 2))
            summaries.append(
                {
                    "start_s": m.get("start_s"),
                    "end_s": m.get("end_s"),
                    "peak_s": m.get("peak_s"),
                    "category": m.get("category"),
                    "score": m.get("score"),
                    "confidence": m.get("confidence"),
                    "touches_edge": m.get("touches_edge"),
                    "what_happened": (str(m.get("what_happened") or "")[:240]),
                }
            )
        except (TypeError, ValueError):
            continue
    payload = {
        "model": meta.get("model") or "",
        "model_requested": meta.get("model_requested") or meta.get("model") or "",
        "model_used": meta.get("model_used") or meta.get("model") or "",
        "model_fallback": bool(meta.get("model_fallback")),
        "fallback_reason": meta.get("fallback_reason"),
        "input_mode": meta.get("input_mode"),
        "fps": meta.get("fps"),
        "frames_est": meta.get("frames_est"),
        "prompt_tokens": meta.get("prompt_tokens"),
        "output_tokens": meta.get("output_tokens"),
        "est_usd": meta.get("est_usd"),
        "moments_count": len(moments),
        "moments_ts_s": ts,
        "moments": summaries,
        "sections": sections or meta.get("sections") or [],
        "min_moments": meta.get("min_moments"),
        "min_moments_met": meta.get("min_moments_met"),
        "ok": bool(meta.get("ok")),
        "error": (meta.get("error") or "")[:300] or None,
        "status": meta.get("status"),
    }
    _emit("videoPicker", payload)


def record_render_stats(clip_id: str, render_payload: dict[str, Any]) -> None:
    row = {
        "clipId": clip_id,
        "projectId": render_payload.get("projectId"),
        "provider": render_payload.get("provider"),
        "ok": render_payload.get("ok"),
        "renderMs": render_payload.get("renderMs"),
        "gpuSeconds": render_payload.get("gpuSeconds"),
        "coldStart": render_payload.get("coldStart"),
        "fallback": render_payload.get("fallback"),
        "reason": render_payload.get("reason"),
    }
    _emit("render", row)


def make_picker_cache_telemetry_sink(
    conn,
    job_id: str,
    job_payload: dict[str, Any],
) -> Callable[[str, dict[str, Any]], None]:
    """Merge telemetry patches into pickerCache on each event."""

    def _sink(kind: str, data: dict[str, Any]) -> None:
        cache = dict(job_payload.get("pickerCache") or {})
        if kind == "videoPicker":
            cache["videoPicker"] = data
        elif kind == "render":
            renders = list(cache.get("renderStats") or [])
            cid = str(data.get("clipId") or "")
            replaced = False
            for i, row in enumerate(renders):
                if str(row.get("clipId") or "") == cid:
                    renders[i] = {**row, **data}
                    replaced = True
                    break
            if not replaced:
                renders.append(data)
            cache["renderStats"] = renders[-32:]
        else:
            return
        job_payload["pickerCache"] = cache
        try:
            merge_job_payload(conn, job_id, {"pickerCache": cache})
        except psycopg2.Error:
            pass

    return _sink
