"""Auto keyword emphasis indexes (one per sentence). Mirrors caption-keyword-emphasis.ts."""
from __future__ import annotations

import re

STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "so",
    "to",
    "of",
    "in",
    "on",
    "at",
    "is",
    "it",
    "that",
    "this",
    "you",
    "we",
    "they",
    "i",
    "my",
    "your",
    "for",
    "with",
    "as",
    "be",
    "are",
    "was",
    "were",
}
STRONG = re.compile(r"\b(never|always|secret|why|how|best|worst|crazy|insane|million|percent|%|\d+)\b", re.I)
FILLER_ONLY = re.compile(r"^(um|uh|erm|hmm|mm|mhm)$", re.I)


def _score(text: str) -> float:
    t = re.sub(r"[^\w'%$]", "", text)
    if not t or len(t) < 2:
        return -1.0
    if FILLER_ONLY.match(t):
        return -1.0
    if t.lower() in STOP:
        return 0.0
    s = min(len(t), 12) / 4.0
    if t[0].isdigit() or STRONG.search(t):
        s += 3.0
    if text[:1].isupper() and len(text) > 2:
        s += 1.5
    if len(t) >= 6:
        s += 0.5
    return s


def _sentence_bounds(words: list[dict]) -> list[int]:
    ends = [0]
    for i, w in enumerate(words):
        if re.search(r'[.!?]["\']?$', str(w.get("w", "")).strip()):
            ends.append(i + 1)
    if ends[-1] != len(words):
        ends.append(len(words))
    return ends


def auto_caption_emphasis_indexes(words: list[dict], edits: dict) -> list[int]:
    if not words:
        return []
    cap = edits.get("captions") if isinstance(edits.get("captions"), dict) else {}
    wpl = min(3, max(1, int(cap.get("wordsPerLine") or 3)))
    bounds = _sentence_bounds(words)
    picked: list[int] = []
    for si in range(len(bounds) - 1):
        slice_w = words[bounds[si] : bounds[si + 1]]
        best_i = None
        best_s = 0.0
        for w in slice_w:
            sc = _score(str(w.get("w", "")))
            if sc > best_s:
                best_s = sc
                best_i = int(w.get("i", w.get("idx", 0)))
        if best_i is not None and best_s >= 1.5:
            picked.append(best_i)
    line_capped: list[int] = []
    for i in range(0, len(words), wpl):
        line = words[i : i + wpl * 2]
        ids = {int(w.get("i", w.get("idx", 0))) for w in line}
        line_capped.extend([p for p in picked if p in ids][:4])
    return list(dict.fromkeys(line_capped))
