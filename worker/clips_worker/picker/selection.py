"""Playbook §7 step 5: greedy selection with archetype diversity."""
from __future__ import annotations

import re
from typing import Any

from clips_worker.picker.config import selection_settings
from clips_worker.picker.log_util import picker_info


def _overlap(a: tuple[int, int], b: tuple[int, int]) -> float:
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
    """R10: >50% overlap on shorter span, or starts within 3s (post-snap)."""
    if abs(int(a["start_ms"]) - int(b["start_ms"])) < 3000:
        return True
    span_a = (int(a["start_ms"]), int(a["end_ms"]))
    span_b = (int(b["start_ms"]), int(b["end_ms"]))
    lo = max(span_a[0], span_b[0])
    hi = min(span_a[1], span_b[1])
    if hi <= lo:
        return False
    overlap_ms = hi - lo
    shorter = min(span_a[1] - span_a[0], span_b[1] - span_b[0])
    return overlap_ms / max(shorter, 1) > 0.5


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


def select_clips(picks: list[dict], source_duration_ms: int, *, force_best: bool = False) -> list[dict]:
    cfg = selection_settings()
    min_final = cfg["min_final"]
    max_clips = cfg["max_clips"]
    per_min = cfg["clips_per_minute"]
    min_arch = cfg["min_archetypes_per_hour"]
    max_share = cfg["max_same_archetype_share"]
    jac_thr = cfg["near_duplicate_jaccard"]
    overlap_drop = cfg["overlap_drop"]

    minutes = max(1, source_duration_ms / 60_000)
    cap = min(max_clips, max(1, int(round(minutes * per_min))))

    ranked = sorted(picks, key=lambda x: -_clip_score(x))
    kept: list[dict] = []
    archetypes: dict[str, int] = {}

    for p in ranked:
        final = _clip_score(p)
        if final < min_final:
            continue
        span = (p["start_ms"], p["end_ms"])
        if any(_overlap(span, (k["start_ms"], k["end_ms"])) > overlap_drop for k in kept):
            continue
        text = p.get("title", "") + " " + p.get("reason", "")
        if any(jaccard(text, k.get("title", "") + " " + k.get("reason", "")) >= jac_thr for k in kept):
            continue
        arch = p.get("archetype") or "unknown"
        if kept and len(kept) >= 2:
            if archetypes.get(arch, 0) / len(kept) >= max_share:
                continue
        kept.append(p)
        archetypes[arch] = archetypes.get(arch, 0) + 1
        if len(kept) >= cap:
            break

    hours = source_duration_ms / 3_600_000
    need_arch = max(0, int(min_arch * hours)) if hours >= 0.5 else 0
    if need_arch and len({p.get("archetype") for p in kept}) < min(need_arch, 2) and len(ranked) > len(kept):
        for p in ranked:
            if p in kept:
                continue
            arch = p.get("archetype")
            if arch and arch not in {k.get("archetype") for k in kept}:
                kept.append(p)
                break

    if not kept and ranked:
        for p in ranked:
            if _clip_score(p) < min_final:
                continue
            kept.append(p)
            if len(kept) >= cap:
                break

    if not kept and ranked and force_best:
        kept = dedupe_r10(ranked[:cap])
        picker_info("selection_force_best", count=len(kept), cap=cap)

    kept = dedupe_r10(kept)
    return kept[:cap]
