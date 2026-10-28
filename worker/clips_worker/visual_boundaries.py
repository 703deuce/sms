"""Visual / LLM clip boundary hints (setup through payoff). Fail-open; extend-only."""
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
    clip_start_ms: int,
    clip_end_ms: int,
    for_setup: bool,
) -> int | None:
    """Return absolute ms hint, or None if invalid for this clip window."""
    if val is None or val == "":
        return None
    try:
        sec = float(val)
    except (TypeError, ValueError):
        return None
    if sec <= 0:
        return None
    candidates: list[int] = [int(sec * 1000)]
    if range_start_ms:
        candidates.append(range_start_ms + int(sec * 1000))
    hi = range_end_ms if range_end_ms is not None else candidates[0] + 120_000
    lo = max(0, range_start_ms - 5_000)
    for abs_ms in candidates:
        if abs_ms < lo or abs_ms > hi + 5_000:
            continue
        if anchor_ms is not None and abs(abs_ms - anchor_ms) > BOUNDARY_ANCHOR_TOLERANCE_MS:
            continue
        lead_ms, tail_ms = _lead_tail_ms()
        if for_setup:
            if abs_ms > clip_end_ms:
                continue
            if abs_ms < clip_start_ms - lead_ms:
                continue
        else:
            if abs_ms < clip_start_ms:
                continue
            if abs_ms > clip_end_ms + tail_ms:
                continue
        return abs_ms
    return None


def boundary_fields_from_llm_row(
    row: dict[str, Any],
    *,
    range_start_ms: int = 0,
    anchor_ms: int | None = None,
    range_end_ms: int | None = None,
    clip_start_ms: int | None = None,
    clip_end_ms: int | None = None,
) -> tuple[int | None, int | None]:
    cs = int(clip_start_ms if clip_start_ms is not None else (anchor_ms or range_start_ms))
    ce = int(clip_end_ms if clip_end_ms is not None else (range_end_ms or cs + 120_000))
    setup = _coerce_boundary_ms(
        row.get("setup_start_s"),
        range_start_ms=range_start_ms,
        anchor_ms=anchor_ms,
        range_end_ms=range_end_ms,
        clip_start_ms=cs,
        clip_end_ms=ce,
        for_setup=True,
    )
    payoff = _coerce_boundary_ms(
        row.get("payoff_end_s"),
        range_start_ms=range_start_ms,
        anchor_ms=anchor_ms,
        range_end_ms=range_end_ms,
        clip_start_ms=cs,
        clip_end_ms=ce,
        for_setup=False,
    )
    return setup, payoff


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
        setup = max(range_start_ms, span_lo)
        payoff = span_hi + tail_ms
        if setup > end_ms:
            setup = None
        if payoff < start_ms:
            payoff = None
        return setup, payoff
    if not hits:
        return None, None
    setup = max(range_start_ms, min(hits) - lead_ms)
    payoff = max(hits) + tail_ms
    if setup > end_ms:
        setup = None
    if payoff < start_ms:
        payoff = None
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
    """Expand span only (never shrink). Invalid hints ignored."""
    if not visual_boundaries_enabled():
        return start_ms, end_ms
    hi = range_end_ms if range_end_ms is not None else end_ms + 120_000
    lead_ms, _tail_ms = _lead_tail_ms()
    s, e = int(start_ms), int(end_ms)
    if boundary_setup_ms is not None:
        setup_i = int(boundary_setup_ms)
        if setup_i <= s and (s - setup_i) <= lead_ms:
            s = min(s, setup_i)
            s = max(range_start_ms, s)
    if boundary_payoff_ms is not None:
        payoff_i = int(boundary_payoff_ms)
        if payoff_i >= s:
            e = max(e, payoff_i)
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
    setup, payoff = None, None
    if llm_row:
        setup, payoff = boundary_fields_from_llm_row(
            llm_row,
            range_start_ms=range_start_ms,
            anchor_ms=anchor_ms,
            range_end_ms=range_end_ms,
            clip_start_ms=start_ms,
            clip_end_ms=end_ms,
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


def visual_moments_overlapping_window(
    visual_moments: list[dict] | None,
    *,
    window_start_ms: int,
    window_end_ms: int,
    range_start_ms: int = 0,
    pad_ms: int = 0,
) -> list[dict]:
    if not visual_moments:
        return []
    from clips_worker.video_picker import moment_abs_span_ms

    out: list[dict] = []
    lo = window_start_ms - pad_ms
    hi = window_end_ms + pad_ms
    for m in visual_moments:
        s_ms, e_ms = moment_abs_span_ms(m, range_start_ms)
        if max(0, min(e_ms, hi) - max(s_ms, lo)) > 0:
            out.append(m)
    return out


def format_visual_moments_for_pass2(moments: list[dict], *, range_start_ms: int = 0) -> str:
    if not moments:
        return "(none overlapping this moment)"
    lines: list[str] = []
    for m in moments[:8]:
        try:
            s = float(m.get("start_s", 0)) + range_start_ms / 1000.0
            e = float(m.get("end_s", s)) + range_start_ms / 1000.0
            sc = float(m.get("score") or 0)
            what = str(m.get("what_happened") or m.get("reason") or "")[:120]
            lines.append(f"- {s:.1f}-{e:.1f}s score={sc:.2f} {what}")
        except (TypeError, ValueError):
            continue
    return "\n".join(lines)
