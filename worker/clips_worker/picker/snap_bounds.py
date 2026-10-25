"""Deterministic clip boundary snap: sentence edges, filler strip, padding."""
from __future__ import annotations

import re
from typing import Any

from clips_worker.picker.log_util import picker_info
from clips_worker.picker.sentences import Sentence

FILLERS = {
    "um",
    "uh",
    "erm",
    "so",
    "and",
    "but",
    "like",
    "you know",
    "i mean",
    "okay",
    "ok",
    "right",
}
PAD_START_S = 0.15
PAD_END_S = 0.35
MAX_EXTEND_S = 8.0
GAP_SENTENCE_END_S = 0.4

_WORD_NORM = re.compile(r"[^\w\s']+")


def _norm_token(w: str) -> str:
    return _WORD_NORM.sub("", w.lower()).strip()


def _is_filler_token(w: str) -> bool:
    t = _norm_token(w)
    return t in FILLERS


def _sentence_at_ms(sentences: list[Sentence], ms: int) -> Sentence | None:
    for s in sentences:
        if s.start_ms <= ms <= s.end_ms:
            return s
    best = None
    best_d = 10**9
    for s in sentences:
        d = min(abs(ms - s.start_ms), abs(ms - s.end_ms))
        if d < best_d:
            best_d = d
            best = s
    return best


def _word_index_at_ms(words: list[dict], ms: int, edge: str = "start") -> int:
    t = ms / 1000.0
    if edge == "start":
        for i, w in enumerate(words):
            if w["e"] >= t:
                return i
        return max(0, len(words) - 1)
    for i in range(len(words) - 1, -1, -1):
        if words[i]["s"] <= t:
            return i
    return 0


def _is_sentence_final_word(words: list[dict], idx: int) -> bool:
    w = words[idx]
    raw = w["w"].rstrip()
    if raw and raw[-1] in ".?!":
        return True
    if idx + 1 < len(words):
        return words[idx + 1]["s"] - w["e"] >= GAP_SENTENCE_END_S
    return True


def _next_sentence_end_ms(sentences: list[Sentence], after_ms: int, limit_ms: int) -> int | None:
    for s in sentences:
        if s.end_ms > after_ms and s.end_ms <= limit_ms:
            return s.end_ms
    return None


def _prev_sentence_end_ms(sentences: list[Sentence], before_ms: int) -> int | None:
    prev = None
    for s in sentences:
        if s.end_ms < before_ms:
            prev = s.end_ms
        elif s.start_ms >= before_ms:
            break
    return prev


def _clamp_ms_to_words(ms: int, words: list[dict], edge: str) -> int:
    if not words:
        return ms
    idx = _word_index_at_ms(words, ms, edge)
    w = words[idx]
    if edge == "start":
        return max(0, int(w["s"] * 1000))
    return int(w["e"] * 1000)


def snap_bounds(
    clip: dict[str, Any],
    words: list[dict],
    sentences: list[Sentence],
    range_start_ms: int,
    range_end_ms: int,
) -> dict[str, Any]:
    """Mutate clip start_ms/end_ms in place; return clip."""
    before = (int(clip.get("start_ms", 0)), int(clip.get("end_ms", 0)))
    start_ms = before[0]
    end_ms = before[1]

    s_start = _sentence_at_ms(sentences, start_ms)
    s_end = _sentence_at_ms(sentences, end_ms)
    if s_start:
        start_ms = s_start.start_ms
    if s_end:
        end_ms = s_end.end_ms

    if not words:
        clip["start_ms"], clip["end_ms"] = start_ms, end_ms
        return clip

    wi = _word_index_at_ms(words, start_ms, "start")
    while wi < len(words) and _is_filler_token(words[wi]["w"]):
        wi += 1
    if wi < len(words):
        start_ms = int(words[wi]["s"] * 1000)

    we = _word_index_at_ms(words, end_ms, "end")
    while we > wi and _is_filler_token(words[we]["w"]):
        we -= 1

    if not _is_sentence_final_word(words, we):
        extend_limit = int(end_ms + MAX_EXTEND_S * 1000)
        extend_limit = min(extend_limit, range_end_ms)
        nxt = _next_sentence_end_ms(sentences, int(words[we]["e"] * 1000), extend_limit)
        if nxt is not None:
            end_ms = nxt
            we = _word_index_at_ms(words, end_ms, "end")
            while we > wi and _is_filler_token(words[we]["w"]):
                we -= 1
        else:
            prev_end = _prev_sentence_end_ms(sentences, int(words[we]["e"] * 1000))
            if prev_end is not None and prev_end > start_ms + 5000:
                end_ms = prev_end
                we = _word_index_at_ms(words, end_ms, "end")
                while we > wi and _is_filler_token(words[we]["w"]):
                    we -= 1
    else:
        end_ms = int(words[we]["e"] * 1000)

    start_ms = int(start_ms - PAD_START_S * 1000)
    end_ms = int(end_ms + PAD_END_S * 1000)
    start_ms = max(range_start_ms, start_ms)
    end_ms = min(range_end_ms, end_ms)
    start_ms = _clamp_ms_to_words(start_ms, words, "start")
    end_ms = _clamp_ms_to_words(end_ms, words, "end")
    if end_ms <= start_ms:
        start_ms, end_ms = before

    clip["start_ms"] = start_ms
    clip["end_ms"] = end_ms
    picker_info(
        "snap_bounds",
        title=str(clip.get("title", ""))[:40],
        before_start=before[0],
        before_end=before[1],
        after_start=start_ms,
        after_end=end_ms,
        first_word=words[_word_index_at_ms(words, start_ms, "start")]["w"] if words else "",
        last_word=words[_word_index_at_ms(words, end_ms, "end")]["w"] if words else "",
    )
    return clip
