"""Resolve overlapping clip picks before render (merge or trim — never silent skip)."""
from __future__ import annotations

from clips_worker.clip_segments import span_overlap_ratio


def _pick_score(p: dict) -> float:
    return float(p.get("final", p.get("score", 0) or 0))


def _overlap_ratio(a: dict, b: dict) -> float:
    return span_overlap_ratio(
        int(a["start_ms"]),
        int(a["end_ms"]),
        int(b["start_ms"]),
        int(b["end_ms"]),
    )


def resolve_overlaps(picks: list[dict], *, min_clip_ms: int = 15_000) -> list[dict]:
    """Trim overlapping spans at overlap midpoint; drop clips shorter than min_clip_ms."""
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
            if ratio >= 0.5:
                if _pick_score(a) >= _pick_score(b):
                    out.pop(i + 1)
                else:
                    out.pop(i)
                merged += 1
                changed = True
                break
            mid = (overlap_start + overlap_end) // 2
            before_a = (as_ms, ae)
            before_b = (bs_ms, be)
            a["end_ms"] = min(ae, mid)
            b["start_ms"] = max(bs_ms, mid)
            trimmed += 1
            changed = True
            print(
                f"[clipper:bounds] before={before_a[0]}-{before_a[1]} "
                f"after={int(a['start_ms'])}-{int(a['end_ms'])} reason=overlap_mid "
                f"title={str(a.get('title', ''))[:40]}",
                flush=True,
            )
            print(
                f"[clipper:bounds] before={before_b[0]}-{before_b[1]} "
                f"after={int(b['start_ms'])}-{int(b['end_ms'])} reason=overlap_mid "
                f"title={str(b.get('title', ''))[:40]}",
                flush=True,
            )
            break
    kept = [p for p in out if int(p["end_ms"]) - int(p["start_ms"]) >= min_clip_ms]
    print(f"[clipper:overlap] merged={merged} trimmed={trimmed} final={len(kept)}", flush=True)
    return kept


def resolve_picks_for_render(picks: list[dict], *, min_clip_ms: int = 15_000) -> list[dict]:
    """Merge same-moment overlaps or trim boundaries so all picks can render."""
    return resolve_overlaps(picks, min_clip_ms=min_clip_ms)
