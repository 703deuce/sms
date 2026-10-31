"""G1c takes (mirror of new-app lib/clips/editor/takes.ts, render side only).

Main-video takes live in cutRanges (nothing to do here). B-roll takes: only the active item of a
group renders; inactive alternates stay in edits.broll for the editor and are dropped here.
"""
from __future__ import annotations

import re

MAX_TAKE_GROUPS = 50
MAX_TAKES = 8
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def inactive_broll_take_ids(edits: dict) -> set[str]:
    raw = edits.get("takes")
    if not isinstance(raw, list):
        return set()
    broll_ids = {str(b.get("id")) for b in (edits.get("broll") or []) if isinstance(b, dict)}
    used_ids: set[str] = set()
    used_items: set[str] = set()
    off: set[str] = set()
    n = 0
    for g in raw:
        if n >= MAX_TAKE_GROUPS:
            break
        if not isinstance(g, dict):
            continue
        gid = g.get("id")
        if not isinstance(gid, str) or not _ID_RE.match(gid) or gid in used_ids:
            continue
        if g.get("kind") == "main":
            # Counted like the web normalizer (it may still drop it; harmless for B-roll).
            used_ids.add(gid)
            n += 1
            continue
        if g.get("kind") != "broll" or not isinstance(g.get("items"), list):
            continue
        items: list[str] = []
        for x in g["items"]:
            if not isinstance(x, str) or x in used_items or x in items or len(items) >= MAX_TAKES:
                continue
            if x not in broll_ids:
                continue
            items.append(x)
        if len(items) < 2:
            continue
        active = g.get("active") if isinstance(g.get("active"), str) and g.get("active") in items else items[0]
        used_items.update(items)
        used_ids.add(gid)
        n += 1
        off.update(x for x in items if x != active)
    return off


def apply_takes(edits: dict) -> dict:
    off = inactive_broll_take_ids(edits)
    if not off or not edits.get("broll"):
        return edits
    return {**edits, "broll": [b for b in edits["broll"] if str(b.get("id")) not in off]}
