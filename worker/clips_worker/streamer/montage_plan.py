"""Plan montage clip order and duration trim (S10)."""
from __future__ import annotations

from typing import Any


def plan_montage_clips(
    clips: list[dict[str, Any]],
    *,
    clip_ids: list[str] | None,
    top_n: int,
    max_duration_s: int,
    order: str,
) -> list[dict[str, Any]]:
    by_id = {c["id"]: c for c in clips if c.get("id")}
    if clip_ids:
        selected = [by_id[cid] for cid in clip_ids if cid in by_id]
    else:
        ranked = sorted(clips, key=lambda c: int(c.get("score") or 0), reverse=True)
        selected = ranked[:top_n]
    if order == "chronological":
        selected = sorted(selected, key=lambda c: int(c.get("startMs") or 0))
    total_ms = 0
    out: list[dict[str, Any]] = []
    for c in selected:
        dur = max(0, int(c.get("endMs") or 0) - int(c.get("startMs") or 0))
        if max_duration_s > 0 and (total_ms + dur) / 1000 > max_duration_s:
            break
        out.append(c)
        total_ms += dur
    return out
