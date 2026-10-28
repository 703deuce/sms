"""Single pick→render planning: neighbor clamp → overlap resolve (one constant) → freeze."""
from __future__ import annotations

from clips_worker.clip_segments import span_overlap_ratio
from clips_worker.streamer.fusion import FusionPick

# One overlap policy for regular + stream + re-render (R2 systemic #3).
PICK_OVERLAP_MERGE_RATIO = 0.35
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
                    out.pop(i + 1)
                else:
                    out.pop(i)
                merged += 1
                changed = True
                break
            mid = (overlap_start + overlap_end) // 2
            a["end_ms"] = min(ae, mid)
            b["start_ms"] = max(bs_ms, mid)
            trimmed += 1
            changed = True
            break
    kept = [p for p in out if int(p["end_ms"]) - int(p["start_ms"]) >= min_clip_ms]
    print(f"[clipper:overlap] merged={merged} trimmed={trimmed} final={len(kept)}", flush=True)
    return kept


def clamp_extends_to_neighbors(picks: list[dict]) -> None:
    """Prevent extend-to-min from growing starts into the previous pick (R2)."""
    if len(picks) <= 1:
        return
    ordered = sorted(picks, key=lambda p: int(p.get("start_ms") or 0))
    for i in range(1, len(ordered)):
        prev = ordered[i - 1]
        cur = ordered[i]
        prev_end = int(prev.get("end_ms") or 0)
        cur_start = int(cur.get("start_ms") or 0)
        if cur_start < prev_end:
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
