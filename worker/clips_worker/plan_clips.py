"""Single pick→render planning: neighbor clamp → overlap resolve (one constant) → freeze."""
from __future__ import annotations

from clips_worker.overlap_policy import PICK_OVERLAP_RATIO, pick_spans_duplicate, span_overlap_ratio
from clips_worker.streamer.fusion import FusionPick

# One overlap policy for regular + stream + re-render (R2 systemic #3).
PICK_OVERLAP_MERGE_RATIO = PICK_OVERLAP_RATIO
DEFAULT_MIN_CLIP_MS = 15_000


def _pick_score(p: dict) -> float:
    return float(p.get("final", p.get("score", 0) or 0))


def _overlap_ratio(a: dict, b: dict) -> float:
    return span_overlap_ratio(
        int(a["start_ms"]),
        int(a["end_ms"]),
        int(b["start_ms"]),
        int(b["end_ms"]),
    )


def _plan_overlap_pass(
    picks: list[dict],
    *,
    min_clip_ms: int,
    merge_ratio: float,
) -> list[dict]:
    from clips_worker.decision_log import decision_log

    if len(picks) <= 1:
        return picks
    out = sorted([dict(p) for p in picks], key=lambda p: int(p["start_ms"]))
    merged = 0
    trimmed = 0
    changed = True
    while changed:
        changed = False
        for i in range(len(out) - 1):
            a, b = out[i], out[i + 1]
            as_ms, ae = int(a["start_ms"]), int(a["end_ms"])
            bs_ms, be = int(b["start_ms"]), int(b["end_ms"])
            if ae <= bs_ms:
                continue
            overlap_start = max(as_ms, bs_ms)
            overlap_end = min(ae, be)
            if overlap_end <= overlap_start:
                continue
            ratio = _overlap_ratio(a, b)
            if ratio >= merge_ratio:
                if _pick_score(a) >= _pick_score(b):
                    kept, dropped = a, b
                    out.pop(i + 1)
                else:
                    kept, dropped = b, a
                    out.pop(i)
                decision_log(
                    "plan_clips",
                    "merge",
                    overlap_ratio=round(ratio, 4),
                    kept_start_ms=int(kept["start_ms"]),
                    kept_end_ms=int(kept["end_ms"]),
                    kept_score=_pick_score(kept),
                    dropped_start_ms=int(dropped["start_ms"]),
                    dropped_end_ms=int(dropped["end_ms"]),
                    dropped_score=_pick_score(dropped),
                )
                merged += 1
                changed = True
                break
            mid = (overlap_start + overlap_end) // 2
            old_a_end, old_b_start = ae, bs_ms
            a["end_ms"] = min(ae, mid)
            b["start_ms"] = max(bs_ms, mid)
            decision_log(
                "plan_clips",
                "trim",
                overlap_ratio=round(ratio, 4),
                a_start_ms=as_ms,
                a_end_ms_old=old_a_end,
                a_end_ms_new=int(a["end_ms"]),
                b_start_ms_old=old_b_start,
                b_start_ms_new=int(b["start_ms"]),
                b_end_ms=be,
            )
            trimmed += 1
            changed = True
            break
    kept: list[dict] = []
    for p in out:
        span = int(p["end_ms"]) - int(p["start_ms"])
        if span >= min_clip_ms:
            kept.append(p)
        else:
            decision_log(
                "plan_clips",
                "min_length_drop",
                start_ms=int(p["start_ms"]),
                end_ms=int(p["end_ms"]),
                span_ms=span,
                min_clip_ms=min_clip_ms,
                score=_pick_score(p),
            )
    decision_log(
        "plan_clips",
        "overlap_pass_summary",
        merged=merged,
        trimmed=trimmed,
        final=len(kept),
    )
    return kept


def clamp_extends_to_neighbors(picks: list[dict]) -> None:
    """Prevent extend-to-min from growing starts into the previous pick (R2)."""
    from clips_worker.decision_log import decision_log

    if len(picks) <= 1:
        return
    ordered = sorted(picks, key=lambda p: int(p.get("start_ms") or 0))
    for i in range(1, len(ordered)):
        prev = ordered[i - 1]
        cur = ordered[i]
        prev_end = int(prev.get("end_ms") or 0)
        cur_start = int(cur.get("start_ms") or 0)
        if cur_start < prev_end:
            decision_log(
                "plan_clips",
                "clamp_extends",
                index=i,
                prev_end_ms=prev_end,
                start_ms_before=cur_start,
                start_ms_after=prev_end,
            )
            cur["start_ms"] = prev_end


def plan_clips(
    picks: list[dict],
    *,
    min_clip_ms: int = DEFAULT_MIN_CLIP_MS,
    merge_ratio: float = PICK_OVERLAP_MERGE_RATIO,
) -> list[dict]:
    """Bounds stages finish before this; render consumes only frozen plans."""
    if not picks:
        return []
    out = [dict(p) for p in picks]
    clamp_extends_to_neighbors(out)
    out = _plan_overlap_pass(out, min_clip_ms=min_clip_ms, merge_ratio=merge_ratio)
    for p in out:
        p["planFrozen"] = True
    return out


def fusion_pick_as_plan_dict(p: FusionPick) -> dict:
    return {
        "start_ms": int(p.start_ms),
        "end_ms": int(p.end_ms),
        "title": p.title,
        "score": p.score,
        "final": p.score,
        "ai_meta": p.ai_meta,
        "peak_ms": p.peak_ms,
        "hook": p.hook,
    }


def fusion_picks_from_planned(planned: list[dict]) -> list[FusionPick]:
    out: list[FusionPick] = []
    for d in planned:
        ai = d.get("ai_meta") if isinstance(d.get("ai_meta"), dict) else {}
        out.append(
            FusionPick(
                start_ms=int(d["start_ms"]),
                end_ms=int(d["end_ms"]),
                title=str(d.get("title") or "Clip")[:120],
                hook=str(d.get("hook") or d.get("title") or "")[:120],
                score=int(d.get("score") or 0),
                scores={"total": int(d.get("score") or 0)},
                ai_meta=ai,
                peak_ms=int(d.get("peak_ms") or (int(d["start_ms"]) + int(d["end_ms"])) // 2),
            )
        )
    return out
