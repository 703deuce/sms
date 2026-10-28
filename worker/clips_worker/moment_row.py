"""Shared moment row coerce/clamp for sanitize + normalize paths."""
from __future__ import annotations

from typing import Any

_MIN_MOMENT_S = 5.0


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def coerce_moment_row(row: Any, duration_s: float) -> dict | None:
    from clips_worker.video_picker import _coerce_moment_row

    return _coerce_moment_row(row, duration_s)


def apply_max_span(
    start: float,
    end: float,
    peak: float,
    hook: float,
    max_span_s: float,
) -> tuple[float, float, float, float]:
    from clips_worker.video_picker import _apply_max_span

    return _apply_max_span(start, end, peak, hook, max_span_s)


def moment_preview(row: Any) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {"type": type(row).__name__}
    return {
        k: row.get(k)
        for k in ("start_s", "end_s", "peak_s", "hook_s", "score", "what_happened")
        if k in row
    }
