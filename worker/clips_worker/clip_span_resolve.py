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


def resolve_picks_for_render(picks: list[dict], *, min_clip_ms: int = 15_000) -> list[dict]:
    """Merge same-moment overlaps or trim boundaries so all picks can render."""
    if len(picks) <= 1:
        return picks
    ranked = sorted(picks, key=lambda p: -_pick_score(p))
    out: list[dict] = []
    for p in ranked:
        cur = dict(p)
        merged = False
        for i, kept in enumerate(out):
            ratio = _overlap_ratio(cur, kept)
            if ratio < 0.35:
                continue
            if ratio >= 0.5:
                if _pick_score(cur) > _pick_score(kept):
                    print(
                        f"[clipper:overlap] merge_render_span action=replace "
                        f"kept={kept.get('start_ms')}-{kept.get('end_ms')} "
                        f"with={cur.get('start_ms')}-{cur.get('end_ms')} overlap={ratio:.2f}",
                        flush=True,
                    )
                    out[i] = cur
                else:
                    print(
                        f"[clipper:overlap] merge_render_span action=drop_duplicate "
                        f"drop={cur.get('start_ms')}-{cur.get('end_ms')} "
                        f"kept={kept.get('start_ms')}-{kept.get('end_ms')} overlap={ratio:.2f}",
                        flush=True,
                    )
                merged = True
                break
            ks, ke = int(kept["start_ms"]), int(kept["end_ms"])
            cs, ce = int(cur["start_ms"]), int(cur["end_ms"])
            if cs < ks:
                new_start, new_end, edge = ke, ce, "start"
            else:
                new_start, new_end, edge = cs, ks, "end"
            if new_end - new_start >= min_clip_ms:
                cur["start_ms"] = new_start
                cur["end_ms"] = new_end
                print(
                    f"[clipper:overlap] trim_render_span edge={edge} "
                    f"after={new_start}-{new_end} overlap={ratio:.2f} "
                    f"title={str(cur.get('title', ''))[:50]}",
                    flush=True,
                )
                if _overlap_ratio(cur, kept) < 0.35:
                    out.append(cur)
                merged = True
                break
            if _pick_score(cur) > _pick_score(kept) and ce - ks >= min_clip_ms:
                kept["start_ms"] = ce
                print(
                    f"[clipper:overlap] trim_render_span edge=kept_start "
                    f"kept_after={kept['start_ms']}-{kept['end_ms']} overlap={ratio:.2f}",
                    flush=True,
                )
                out.append(cur)
                merged = True
                break
            if ke - cs >= min_clip_ms:
                kept["end_ms"] = cs
                print(
                    f"[clipper:overlap] trim_render_span edge=kept_end "
                    f"kept_after={kept['start_ms']}-{kept['end_ms']} overlap={ratio:.2f}",
                    flush=True,
                )
                merged = True
                break
        if not merged:
            out.append(cur)
    out.sort(key=lambda p: -_pick_score(p))
    return out
