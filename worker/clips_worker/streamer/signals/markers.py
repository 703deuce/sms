"""Stream marker / chapter boundaries as per-second signal."""
from __future__ import annotations


def markers_signal_per_second(chapters: list[dict] | None, duration_s: int) -> list[float]:
    if duration_s <= 0 or not chapters:
        return [0.0] * max(0, duration_s)
    out = [0.0] * duration_s
    for ch in chapters:
        try:
            ms = int(ch.get("startMs") or ch.get("start_ms") or ch.get("position") or 0)
        except (TypeError, ValueError):
            continue
        sec = max(0, min(duration_s - 1, ms // 1000))
        out[sec] = 1.0
        if sec + 1 < duration_s:
            out[sec + 1] = max(out[sec + 1], 0.65)
    return out
