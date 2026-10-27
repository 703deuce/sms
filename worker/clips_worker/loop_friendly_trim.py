"""Trim clip end for smoother TikTok/Shorts loops when opener and closer align."""
from __future__ import annotations

import os
import re

TOKEN_RE = re.compile(r"[a-z0-9']+", re.I)
STOP = frozenset(
    "the a an and or but so to of in on at is it that this you we they i for with as be are was".split()
)


def loop_friendly_enabled(edits: dict, export_platform: str | None = None) -> bool:
    if os.environ.get("CLIP_POLISH_LOOP_END") == "0":
        return False
    if edits.get("loopFriendlyEnd") is False:
        return False
    if edits.get("loopFriendlyEnd") is True:
        return True
    plat = export_platform or edits.get("exportPlatformId")
    return plat in ("tiktok", "youtube_shorts")


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in TOKEN_RE.findall(text) if len(t) > 2 and t.lower() not in STOP}


def loop_alignment_score(first_words: list[str], last_words: list[str]) -> float:
    a = _tokens(" ".join(first_words))
    b = _tokens(" ".join(last_words))
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))


def apply_loop_friendly_trim(
    edits: dict,
    words: list[dict],
    *,
    export_platform: str | None = None,
) -> dict:
    if not loop_friendly_enabled(edits, export_platform):
        return edits
    trim = edits.get("trim") or {}
    tin = int(trim.get("in") or 0)
    tout = int(trim.get("out") or tin)
    if tout - tin < 4000:
        return edits

    ordered = sorted(
        [w for w in words if str(w.get("w", "")).strip()],
        key=lambda w: float(w.get("s", 0)),
    )
    if len(ordered) < 4:
        return edits

    texts = [str(w.get("w", "")).strip() for w in ordered]
    score = loop_alignment_score(texts[:5], texts[-5:])
    last = ordered[-1]
    last_end = float(last.get("e", 0))
    payoff = bool(re.search(r"[!?…]$", texts[-1])) or score >= 0.22
    if not payoff:
        return edits

    last_end_ms = int(last_end * 1000) if last_end < 1e6 else int(last_end)
    if last_end_ms < tin + 1500:
        return edits
    new_out = min(tout, last_end_ms + 220)
    if new_out <= tin + 2500 or tout - new_out < 80:
        return edits
    return {
        **edits,
        "trim": {**trim, "in": tin, "out": new_out},
        "loopFriendlyEnd": True,
    }
