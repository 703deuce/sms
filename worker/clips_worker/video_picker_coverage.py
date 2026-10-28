"""Coverage gaps for video-picker shortfall retries (time spans, not whole sections)."""
from __future__ import annotations

from typing import Any

DEFAULT_MOMENT_COVERAGE_PAD_S = 30.0
DEFAULT_UNCOVERED_WINDOW_S = 40.0


def _clip_interval(lo: float, hi: float, *, bound_lo: float, bound_hi: float) -> tuple[float, float] | None:
    lo = max(bound_lo, lo)
    hi = min(bound_hi, hi)
    if hi - lo < 1.0:
        return None
    return lo, hi


def _subtract_interval(
    gaps: list[tuple[float, float]],
    cut_lo: float,
    cut_hi: float,
) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for lo, hi in gaps:
        if cut_hi <= lo or cut_lo >= hi:
            out.append((lo, hi))
            continue
        if cut_lo > lo:
            out.append((lo, cut_lo))
        if cut_hi < hi:
            out.append((cut_hi, hi))
    return out


def _split_gap(lo: float, hi: float, window_s: float) -> list[tuple[float, float]]:
    span = hi - lo
    if span <= window_s + 0.5:
        return [(lo, hi)]
    windows: list[tuple[float, float]] = []
    t = lo
    while t < hi - 0.5:
        end = min(hi, t + window_s)
        if end - t >= 5.0:
            windows.append((t, end))
        t = end
    return windows


def compute_uncovered_spans(
    sections: list[dict],
    moments: list[dict],
    duration_s: float,
    *,
    pad_s: float = DEFAULT_MOMENT_COVERAGE_PAD_S,
    window_s: float = DEFAULT_UNCOVERED_WINDOW_S,
) -> list[dict[str, Any]]:
    """Return uncovered time windows (not covered within ±pad_s of any kept moment)."""
    dur = max(1.0, float(duration_s))
    pad = max(5.0, float(pad_s))
    win = max(20.0, min(45.0, float(window_s)))

    if sections:
        gaps: list[tuple[float, float]] = []
        for sec in sections:
            try:
                a = float(sec.get("start_s", 0))
                b = float(sec.get("end_s", a))
            except (TypeError, ValueError):
                continue
            clipped = _clip_interval(a, b, bound_lo=0.0, bound_hi=dur)
            if clipped:
                gaps.append(clipped)
        if not gaps:
            gaps = [(0.0, dur)]
    else:
        gaps = [(0.0, dur)]

    for m in moments:
        try:
            ms = float(m.get("start_s", 0))
            me = float(m.get("end_s", ms))
        except (TypeError, ValueError):
            continue
        mid = (ms + me) / 2.0
        cut_lo = max(0.0, mid - pad)
        cut_hi = min(dur, mid + pad)
        gaps = _subtract_interval(gaps, cut_lo, cut_hi)

    spans: list[dict[str, Any]] = []
    for lo, hi in gaps:
        if hi - lo < 8.0:
            continue
        for w_lo, w_hi in _split_gap(lo, hi, win):
            act = ""
            for sec in sections:
                try:
                    a = float(sec.get("start_s", 0))
                    b = float(sec.get("end_s", a))
                except (TypeError, ValueError):
                    continue
                if w_lo < b and w_hi > a:
                    act = str(sec.get("activity") or "section")[:80]
                    break
            spans.append(
                {
                    "start_s": round(w_lo, 2),
                    "end_s": round(w_hi, 2),
                    "activity": act or "uncovered",
                    "label": f"{w_lo:.0f}-{w_hi:.0f}s {act or 'uncovered'}",
                }
            )
    return spans


def uncovered_labels_for_prompt(spans: list[dict[str, Any]], *, limit: int = 8) -> list[str]:
    return [str(s.get("label") or "") for s in spans[:limit] if s.get("label")]
