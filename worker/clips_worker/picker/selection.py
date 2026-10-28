"""Playbook §7 step 5: ship all scored picks; merge only >50% timeline overlap."""
from __future__ import annotations

import re
from typing import Any

from clips_worker.picker.config import selection_settings
from clips_worker.picker.log_util import picker_info


def _overlap_fraction(a: tuple[int, int], b: tuple[int, int]) -> float:
    lo = max(a[0], b[0])
    hi = min(a[1], b[1])
    if hi <= lo:
        return 0.0
    span = min(a[1] - a[0], b[1] - b[0])
    return (hi - lo) / max(span, 1)


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9']+", text.lower()))


def jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _clip_score(p: dict) -> float:
    return float(p.get("final", p.get("score", 0) / 10))


def _r10_near_duplicate(a: dict, b: dict) -> bool:
    """>50% overlap on shorter span (no start-within-3s rule)."""
    span_a = (int(a["start_ms"]), int(a["end_ms"]))
    span_b = (int(b["start_ms"]), int(b["end_ms"]))
    return _overlap_fraction(span_a, span_b) > 0.5


def dedupe_r10(picks: list[dict]) -> list[dict]:
    ranked = sorted(picks, key=lambda x: -_clip_score(x))
    kept: list[dict] = []
    for p in ranked:
        if any(_r10_near_duplicate(p, k) for k in kept):
            continue
        kept.append(p)
    if len(kept) != len(picks):
        picker_info("dedupe_r10", before=len(picks), after=len(kept))
    return kept


def _duplicate_of_kept(p: dict, kept: list[dict]) -> dict | None:
    span = (int(p["start_ms"]), int(p["end_ms"]))
    for k in kept:
        if _overlap_fraction(span, (int(k["start_ms"]), int(k["end_ms"]))) > 0.5:
            return k
    return None


MIN_DISTINCT_SHIPPED = 6


def top_up_selected_picks(selected: list[dict], pool: list[dict], *, min_n: int = MIN_DISTINCT_SHIPPED) -> list[dict]:
    """After overlap dedupe, ship at least min_n distinct moments when the pool allows."""
    if len(selected) >= min_n or len(pool) <= len(selected):
        return selected
    ranked = sorted(pool, key=lambda x: -_clip_score(x))
    out = list(selected)
    for p in ranked:
        if len(out) >= min_n:
            break
        if any(
            int(p["start_ms"]) == int(k["start_ms"]) and int(p["end_ms"]) == int(k["end_ms"]) for k in out
        ):
            continue
        if _duplicate_of_kept(p, out) is not None:
            continue
        picker_info(
            "selection_top_up",
            title=str(p.get("title", ""))[:80],
            start_ms=int(p["start_ms"]),
            end_ms=int(p["end_ms"]),
            score=_clip_score(p),
            selected=len(out) + 1,
            target=min_n,
        )
        out.append(p)
    return out


def select_clips(
    picks: list[dict],
    source_duration_ms: int,
    *,
    force_best: bool = False,
) -> list[dict]:
    """Keep every candidate unless it >50% overlaps a higher-scored pick (same span rule as R10)."""
    del force_best  # legacy kwarg; behavior is always rank-and-ship
    cfg = selection_settings()
    max_clips = int(cfg["max_clips"])

    ranked = sorted(picks, key=lambda x: -_clip_score(x))
    kept: list[dict] = []
    for p in ranked:
        dup = _duplicate_of_kept(p, kept)
        if dup is not None:
            picker_info(
                "selection_drop",
                reason="overlap_duplicate",
                title=str(p.get("title", ""))[:80],
                start_ms=int(p["start_ms"]),
                end_ms=int(p["end_ms"]),
                score=_clip_score(p),
                kept_title=str(dup.get("title", ""))[:80],
                kept_start_ms=int(dup["start_ms"]),
                kept_score=_clip_score(dup),
            )
            continue
        kept.append(p)

    if len(kept) > max_clips:
        overflow = kept[max_clips:]
        kept = kept[:max_clips]
        for p in overflow:
            picker_info(
                "selection_drop",
                reason="max_clips_cap",
                cap=max_clips,
                title=str(p.get("title", ""))[:80],
                start_ms=int(p["start_ms"]),
                end_ms=int(p["end_ms"]),
                score=_clip_score(p),
            )

    picker_info(
        "selection",
        candidates=len(picks),
        selected=len(kept),
        source_duration_ms=int(source_duration_ms),
        max_clips=max_clips,
    )
    return kept
