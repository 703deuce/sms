"""Recall@K vs viewer-made Twitch clips (overlap >= threshold)."""
from __future__ import annotations


def span_overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    inter = max(0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def viewer_clip_to_ms(vc: dict) -> tuple[int, int]:
    start_s = int(vc.get("vod_offset_s") or vc.get("start_s") or 0)
    dur_s = float(vc.get("duration_s") or 30)
    start_ms = start_s * 1000
    end_ms = int(start_ms + dur_s * 1000)
    return start_ms, end_ms


def recall_at_k(
    picks: list[dict],
    ground_truth: list[dict],
    k: int,
    *,
    min_overlap: float = 0.5,
) -> float:
    """picks: {startMs|start_ms, endMs|end_ms}; ground_truth: viewer clip dicts."""
    if not ground_truth:
        return 1.0
    top = picks[:k]
    hits = 0
    for gt in ground_truth:
        g0, g1 = viewer_clip_to_ms(gt)
        if any(
            span_overlap_ratio(
                int(p.get("startMs") or p.get("start_ms") or 0),
                int(p.get("endMs") or p.get("end_ms") or 0),
                g0,
                g1,
            )
            >= min_overlap
            for p in top
        ):
            hits += 1
    return hits / len(ground_truth)
