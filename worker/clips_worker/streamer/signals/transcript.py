"""Transcript hype density per second."""
from __future__ import annotations

import re

from clips_worker.streamer.lexicon import HYPE_PHRASES, PROFANITY


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def transcript_signal_per_second(words: list[dict], duration_s: int) -> list[float]:
    if duration_s <= 0:
        return []
    buckets: list[list[str]] = [[] for _ in range(duration_s)]
    for w in words:
        t = _norm(str(w.get("w") or ""))
        if not t:
            continue
        sec = int(float(w.get("s", 0)))
        if 0 <= sec < duration_s:
            buckets[sec].append(t)
    phrases = tuple(HYPE_PHRASES + PROFANITY)
    out: list[float] = []
    for sec in range(duration_s):
        text = " ".join(buckets[sec])
        if not text:
            out.append(0.0)
            continue
        hits = sum(1 for p in phrases if p in text)
        punct = text.count("?") + text.count("!")
        rate = min(1.0, (hits * 0.35 + punct * 0.1) / max(1, len(buckets[sec])))
        out.append(rate)
    return out
