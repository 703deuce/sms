"""Single overlap policy for picker dedupe, selection, plan_clips, and render guards."""
from __future__ import annotations

# Fraction of the shorter span that must overlap to treat two picks as duplicates / merge.
PICK_OVERLAP_RATIO = 0.35

# Headstart cache reuse: planned span must match rendered span within this tolerance (ms).
HEADSTART_SPAN_MATCH_MS = 500


def span_overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    overlap = max(0, min(a1, b1) - max(a0, b0))
    span = max(1, min(a1 - a0, b1 - b0))
    return overlap / span


def spans_overlap(a0: int, a1: int, b0: int, b1: int, *, ratio: float = PICK_OVERLAP_RATIO) -> bool:
    return span_overlap_ratio(a0, a1, b0, b1) >= ratio


def pick_spans_duplicate(
    a_start_ms: int,
    a_end_ms: int,
    b_start_ms: int,
    b_end_ms: int,
    *,
    ratio: float = PICK_OVERLAP_RATIO,
) -> bool:
    return spans_overlap(a_start_ms, a_end_ms, b_start_ms, b_end_ms, ratio=ratio)


def spans_match_planned_render(
    planned_start_ms: int,
    planned_end_ms: int,
    rendered_start_ms: int,
    rendered_end_ms: int,
    *,
    tol_ms: int = HEADSTART_SPAN_MATCH_MS,
) -> bool:
    return (
        abs(int(planned_start_ms) - int(rendered_start_ms)) <= tol_ms
        and abs(int(planned_end_ms) - int(rendered_end_ms)) <= tol_ms
    )
