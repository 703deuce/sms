"""Visual / LLM clip boundary hints (setup through payoff). Fail-open."""
from __future__ import annotations

import os
from typing import Any

from clips_worker.video_picker import absolute_moment_ms

DEFAULT_SETUP_LEAD_MS = 2500
DEFAULT_PAYOFF_TAIL_MS = 1500
BOUNDARY_ANCHOR_TOLERANCE_MS = 30_000


def visual_boundaries_enabled() -> bool:
    raw = (os.environ.get("VIDEO_BOUNDARY_HINTS_ENABLED") or "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _lead_tail_ms() -> tuple[int, int]:
    try:
        lead = int(float(os.environ.get("VIDEO_BOUNDARY_SETUP_LEAD_S", "2.5")) * 1000)
    except (TypeError, ValueError):
        lead = DEFAULT_SETUP_LEAD_MS
    try:
        tail = int(float(os.environ.get("VIDEO_BOUNDARY_PAYOFF_TAIL_S", "1.5")) * 1000)
    except (TypeError, ValueError):
        tail = DEFAULT_PAYOFF_TAIL_MS
    return max(0, lead), max(500, tail)


def _coerce_boundary_ms(
    val: Any,
    *,
    range_start_ms: int,
    anchor_ms: int | None,
    range_end_ms: int | None,
) -> int | None:
    if val is None or val == "":
        return None
    try:
        sec = float(val)
    except (TypeError, ValueError):
        return None
    if sec <= 0:
        return None
    candidates: list[int] = [int(sec * 1000)]
    # Legacy trim-relative hints (pre absolute-second prompt).
    if range_start_ms:
        candidates.append(range_start_ms + int(sec * 1000))
    hi = range_end_ms if range_end_ms is not None else candidates[0] + 120_000
    lo = max(0, range_start_ms - 5_000)
    for abs_ms in candidates:
        if abs_ms < lo or abs_ms > hi + 5_000:
            continue
        if anchor_ms is not None and abs(abs_ms - anchor_ms) > BOUNDARY_ANCHOR_TOLERANCE_MS:
            continue
        return abs_ms
    return None


def infer_boundaries_from_moments(
    start_ms: int,
    end_ms: int,
    video_moments: list[dict] | None,
    *,
    range_start_ms: int = 0,
    pad_ms: int = 6000,
) -> tuple[int | None, int | None]:
    if not video_moments:
        return None, None
    from clips_worker.video_picker import moment_abs_span_ms

    lead_ms, tail_ms = _lead_tail_ms()
    span_lo: int | None = None
    span_hi: int | None = None
    hits: list[int] = []
    for m in video_moments:
        s_ms, e_ms = moment_abs_span_ms(m, range_start_ms)
        if e_ms >= start_ms - pad_ms and s_ms <= end_ms + pad_ms:
            if e_ms > s_ms + 2000:
                span_lo = s_ms if span_lo is None else min(span_lo, s_ms)
                span_hi = e_ms if span_hi is None else max(span_hi, e_ms)
            else:
                hits.append(absolute_moment_ms(m, range_start_ms))
    if span_lo is not None and span_hi is not None:
        return max(range_start_ms, span_lo), span_hi + tail_ms
    if not hits:
        return None, None
    setup = max(range_start_ms, min(hits) - lead_ms)
    payoff = max(hits) + tail_ms
    return setup, payoff


def boundary_fields_from_llm_row(
    row: dict[str, Any],
    *,
    range_start_ms: int = 0,
    anchor_ms: int | None = None,
    range_end_ms: int | None = None,
) -> tuple[int | None, int | None]:
    setup = _coerce_boundary_ms(
        row.get("setup_start_s"),
        range_start_ms=range_start_ms,
        anchor_ms=anchor_ms,
        range_end_ms=range_end_ms,
    )
    payoff = _coerce_boundary_ms(
        row.get("payoff_end_s"),
        range_start_ms=range_start_ms,
        anchor_ms=anchor_ms,
        range_end_ms=range_end_ms,
    )
    return setup, payoff


def merge_window_with_boundaries(
    start_ms: int,
    end_ms: int,
    *,
    boundary_setup_ms: int | None,
    boundary_payoff_ms: int | None,
    range_start_ms: int = 0,
    range_end_ms: int | None = None,
) -> tuple[int, int]:
    """Expand/adjust span to honor visual boundaries; never raises."""
    if not visual_boundaries_enabled():
        return start_ms, end_ms
    hi = range_end_ms if range_end_ms is not None else end_ms + 120_000
    s, e = int(start_ms), int(end_ms)
    if boundary_setup_ms is not None:
        s = min(s, int(boundary_setup_ms))
        s = max(range_start_ms, s)
    if boundary_payoff_ms is not None:
        e = max(e, int(boundary_payoff_ms))
    e = min(hi, e)
    if e <= s:
        return start_ms, end_ms
    return s, e


def resolve_boundaries_for_window(
    start_ms: int,
    end_ms: int,
    llm_row: dict[str, Any] | None,
    video_moments: list[dict] | None,
    *,
    range_start_ms: int = 0,
    range_end_ms: int | None = None,
    anchor_ms: int | None = None,
) -> tuple[int, int, int | None, int | None]:
    """Return (start_ms, end_ms, setup_ms, payoff_ms) for snapping metadata."""
    setup, payoff = None, None
    if llm_row:
        setup, payoff = boundary_fields_from_llm_row(
            llm_row,
            range_start_ms=range_start_ms,
            anchor_ms=anchor_ms,
            range_end_ms=range_end_ms,
        )
    if setup is None and payoff is None and video_moments:
        setup, payoff = infer_boundaries_from_moments(
            start_ms, end_ms, video_moments, range_start_ms=range_start_ms
        )
    ns, ne = merge_window_with_boundaries(
        start_ms,
        end_ms,
        boundary_setup_ms=setup,
        boundary_payoff_ms=payoff,
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
    )
    return ns, ne, setup, payoff
