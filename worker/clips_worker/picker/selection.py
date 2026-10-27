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


def _tile_short_source(
    kept: list[dict],
    ranked: list[dict],
    source_duration_ms: int,
    target: int,
) -> list[dict]:
    """Split a short source into non-overlapping clips when LLM/selection yields too few."""
    if source_duration_ms > 3 * 60_000 or len(kept) >= target:
        return kept
    min_dur = 15_000
    max_dur = 60_000
    template = kept[0] if kept else (ranked[0] if ranked else None)
    if len(kept) == 1 and target > 1:
        lone = kept[0]
        span_start, span_end = int(lone["start_ms"]), int(lone["end_ms"])
        span = span_end - span_start
        if span >= min_dur * 2:
            step = max(min_dur, span // target)
            tiles: list[dict] = []
            t = span_start
            while t < span_end and len(tiles) < target:
                end = min(span_end, t + step)
                if end - t < min_dur:
                    break
                if end - t > max_dur:
                    end = t + max_dur
                tiles.append(
                    {
                        **lone,
                        "start_ms": t,
                        "end_ms": end,
                        "title": f"Clip {len(tiles) + 1}",
                        "low_confidence": True,
                    }
                )
                t = end
            if len(tiles) >= 2:
                picker_info("short_source_split", clips=len(tiles), target=target)
                return tiles[:target]
    if template:
        span_start = int(template["start_ms"])
        span_end = int(template["end_ms"])
    else:
        span_start, span_end = 0, source_duration_ms
    span = span_end - span_start
    if span < min_dur * max(1, target - len(kept)):
        span_start, span_end = 0, source_duration_ms
        span = source_duration_ms
    if span < min_dur:
        return kept
    need = target - len(kept)
    chunk_ms = max(min_dur, min(max_dur, span // max(need, 1)))
    tiles: list[dict] = []
    t = span_start
    while t < span_end and len(tiles) < need:
        end = min(span_end, t + chunk_ms)
        if end - t < min_dur:
            break
        row = {
            **(template or {}),
            "start_ms": t,
            "end_ms": end,
            "title": f"Clip {len(kept) + len(tiles) + 1}",
            "low_confidence": True,
        }
        tiles.append(row)
        t = end
    if not tiles:
        return kept
    picker_info("short_source_tile", added=len(tiles), target=target, before=len(kept))
    return kept + tiles


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


def select_clips(picks: list[dict], source_duration_ms: int) -> list[dict]:
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
    if source_duration_ms <= 5 * 60_000:
        cap = max(cap, min(3, max_clips))

    ranked = sorted(picks, key=lambda x: -_clip_score(x))
    kept: list[dict] = []
    archetypes: dict[str, int] = {}

    for p in ranked:
        final = _clip_score(p)
        if final < min_final and kept:
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
        for p in ranked[: min(3, cap)]:
            p["low_confidence"] = True
            kept.append(p)

    kept = dedupe_r10(kept)

    short_floor = 3 if source_duration_ms <= 3 * 60_000 else 0
    short_target = min(short_floor, cap) if short_floor else 0
    if short_target and len(kept) < short_target:
        relaxed = min(0.85, overlap_drop + 0.35)
        for p in ranked:
            if p in kept:
                continue
            span = (p["start_ms"], p["end_ms"])
            dur = span[1] - span[0]
            if dur < 15_000 or dur > 60_000:
                continue
            if any(_overlap(span, (k["start_ms"], k["end_ms"])) > relaxed for k in kept):
                continue
            kept.append(p)
            if len(kept) >= short_target:
                break

    if short_target and len(kept) < short_target:
        kept = _tile_short_source(kept, ranked, source_duration_ms, short_target)

    kept = dedupe_r10(kept)

    if short_target and len(kept) < short_target:
        kept = _tile_short_source([], ranked, source_duration_ms, short_target)

    return kept[:cap]
