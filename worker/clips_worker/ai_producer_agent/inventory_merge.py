"""Merge inventories across sources (deterministic)."""

from __future__ import annotations

from typing import Any


def merge(p: dict[str, Any]) -> dict[str, Any]:
    invs = p.get("inventories") or []
    beats = []
    for inv in invs:
        sid = inv.get("sourceId")
        for b in inv.get("beats") or []:
            beats.append({**b, "sourceId": sid})
    links = []
    for i, a in enumerate(beats):
        for b in beats[i + 1 :]:
            if a.get("sourceId") == b.get("sourceId"):
                continue
            ta = str(a.get("text") or "")
            tb = str(b.get("text") or "")
            overlap = len(set(ta.lower().split()) & set(tb.lower().split())) / max(1, len(set(ta.lower().split()) | set(tb.lower().split())))
            if overlap >= 0.5:
                links.append({"kind": "callback", "from": a.get("id"), "to": b.get("id"), "score": round(overlap, 3)})
    return {"beats": sorted(beats, key=lambda x: (x.get("sourceId"), x.get("s", 0))), "links": links, "costUsd": 0}
