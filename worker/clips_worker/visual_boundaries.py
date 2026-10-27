"""Visual / LLM clip boundary hints (setup through payoff). Fail-open."""
from __future__ import annotations

import os
from typing import Any

from clips_worker.video_picker import absolute_moment_ms

DEFAULT_SETUP_LEAD_MS = 2500
DEFAULT_PAYOFF_TAIL_MS = 1500


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


def _ms_from_llm_seconds(val: Any, range_start_ms: int) -> int | None:
    if val is None or val == "":
        return None
    try:
        sec = float(val)
    except (TypeError, ValueError):
        return None
    if sec <= 0:
        return None
    return range_start_ms + int(sec * 1000)


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
    lead_ms, tail_ms = _lead_tail_ms()
    hits: list[int] = []
    for m in video_moments:
        t_ms = absolute_moment_ms(m, range_start_ms)
        if start_ms - pad_ms <= t_ms <= end_ms + pad_ms:
            hits.append(t_ms)
    if not hits:
        return None, None
    setup = max(range_start_ms, min(hits) - lead_ms)
    payoff = max(hits) + tail_ms
    return setup, payoff


def boundary_fields_from_llm_row(
    row: dict[str, Any],
    *,
    range_start_ms: int = 0,
) -> tuple[int | None, int | None]:
    setup = _ms_from_llm_seconds(row.get("setup_start_s"), range_start_ms)
    payoff = _ms_from_llm_seconds(row.get("payoff_end_s"), range_start_ms)
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
) -> tuple[int, int, int | None, int | None]:
    """Return (start_ms, end_ms, setup_ms, payoff_ms) for snapping metadata."""
    setup, payoff = None, None
    if llm_row:
        setup, payoff = boundary_fields_from_llm_row(llm_row, range_start_ms=range_start_ms)
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
