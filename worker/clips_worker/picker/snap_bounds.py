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
    "no",
    "yeah",
    "yes",
    "yep",
    "mhm",
    "exactly",
    "totally",
    "sure",
    "wow",
    "oh",
}
PAD_START_S = 0.25  # FIX2 R5: ASR onsets lag the real attack; capped by the previous word end (see _preroll_start_ms)
PAD_END_S = 0.5
# FIX1: answer/reaction words that are fillers at a START but the payoff at an END.
_END_KEEP = {"no", "yes", "yeah", "yep", "right", "exactly", "okay", "ok", "sure", "totally", "wow", "oh"}
MAX_EXTEND_S = 8.0
SENTENCE_EXTEND_MAX_S = 3.0
GAP_SENTENCE_END_S = 0.4
LEADING_DEAD_AIR_S = 0.3
GREETING_WINDOW_MS = 1500

_WORD_NORM = re.compile(r"[^\w\s']+")


def _norm_token(w: str) -> str:
    return _WORD_NORM.sub("", w.lower()).strip()


def _is_filler_token(w: str) -> bool:
    t = _norm_token(w)
    return t in FILLERS


def _sentence_word_tokens(sentence: Sentence) -> list[str]:
    return [_norm_token(p) for p in sentence.text.split() if _norm_token(p)]


def _is_micro_filler_sentence(sentence: Sentence) -> bool:
    """<=3 words and every token is a filler/reaction (dangling opener)."""
    toks = _sentence_word_tokens(sentence)
    if not toks or len(toks) > 3:
        return False
    return all(t in FILLERS for t in toks)


def _sentence_list_index(sentences: list[Sentence], s: Sentence) -> int:
    for i, row in enumerate(sentences):
        if row.idx == s.idx:
            return i
    return 0


def _advance_to_substantive_start(sentences: list[Sentence], s: Sentence) -> int:
    i = _sentence_list_index(sentences, s)
    while i < len(sentences) and _is_micro_filler_sentence(sentences[i]):
        i += 1
    if i < len(sentences):
        return sentences[i].start_ms
    return s.start_ms


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


SNAP_WORD_WINDOW_MS = 3000
SNAP_MIN_OVERLAP_RATIO = 0.5
SNAP_MIN_SPAN_MS = 15_000


def _word_index_at_ms(
    words: list[dict],
    ms: int,
    edge: str = "start",
    *,
    window_lo_ms: int | None = None,
    window_hi_ms: int | None = None,
) -> int:
    lo_s = (window_lo_ms / 1000.0) if window_lo_ms is not None else None
    hi_s = (window_hi_ms / 1000.0) if window_hi_ms is not None else None
    t = ms / 1000.0
    if edge == "start":
        for i, w in enumerate(words):
            if lo_s is not None and w["e"] < lo_s:
                continue
            if hi_s is not None and w["s"] > hi_s:
                break
            if w["e"] >= t:
                return i
        if window_lo_ms is not None or window_hi_ms is not None:
            return -1
        return max(0, len(words) - 1)
    for i in range(len(words) - 1, -1, -1):
        w = words[i]
        if lo_s is not None and w["e"] < lo_s:
            continue
        if hi_s is not None and w["s"] > hi_s:
            continue
        if w["s"] <= t <= w["e"] + 1e-6:
            return i
    for i in range(len(words) - 1, -1, -1):
        w = words[i]
        if lo_s is not None and w["e"] < lo_s:
            continue
        if hi_s is not None and w["s"] > hi_s:
            continue
        if w["e"] <= t + 1e-6:
            return i
    if window_lo_ms is not None or window_hi_ms is not None:
        return -1
    return 0


def _span_overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    lo = max(a0, b0)
    hi = min(a1, b1)
    if hi <= lo:
        return 0.0
    return (hi - lo) / max(1, b1 - b0)


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


def _sentence_final_word_index_at_or_before(words: list[dict], idx: int) -> int:
    for j in range(idx, -1, -1):
        if _is_sentence_final_word(words, j):
            return j
    return idx


def _new_incomplete_sentence_after(words: list[dict], we: int, last_final: int) -> bool:
    """Picked end sits in a new sentence that has not reached a sentence-final word yet."""
    if last_final >= we:
        return False
    if _is_sentence_final_word(words, we):
        return False
    tail = words[last_final]["w"].rstrip()
    if re.search(r"[.?!]$", tail):
        return True
    if last_final + 1 <= we:
        gap = words[last_final + 1]["s"] - words[last_final]["e"]
        if gap >= GAP_SENTENCE_END_S:
            return True
    return False


def _length_limit_ms(clip: dict[str, Any], range_end_ms: int) -> int:
    start = int(clip.get("start_ms", 0))
    for key in ("length_max_ms", "lengthMaxMs"):
        raw = clip.get(key)
        if isinstance(raw, (int, float)) and raw > 0:
            return min(range_end_ms, start + int(raw))
    return range_end_ms


def _clamp_ms_to_words(ms: int, words: list[dict], edge: str) -> int:
    if not words:
        return ms
    idx = _word_index_at_ms(words, ms, edge)
    w = words[idx]
    if edge == "start":
        return max(0, int(w["s"] * 1000))
    return int(w["e"] * 1000)


def _apply_visual_boundary_anchors(
    clip: dict[str, Any],
    words: list[dict],
    sentences: list[Sentence],
    range_start_ms: int,
    range_end_ms: int,
    start_ms: int,
    end_ms: int,
    *,
    before_start: int,
    before_end: int,
) -> tuple[int, int]:
    try:
        from clips_worker.visual_boundaries import merge_window_with_boundaries, visual_boundaries_enabled
    except Exception:
        return start_ms, end_ms
    if not visual_boundaries_enabled():
        return start_ms, end_ms
    setup = clip.get("boundary_setup_ms")
    payoff = clip.get("boundary_payoff_ms")
    if setup is None and payoff is None:
        return start_ms, end_ms
    try:
        start_ms, end_ms = merge_window_with_boundaries(
            start_ms,
            end_ms,
            boundary_setup_ms=int(setup) if setup is not None else None,
            boundary_payoff_ms=int(payoff) if payoff is not None else None,
            range_start_ms=range_start_ms,
            range_end_ms=range_end_ms,
        )
        if setup is not None:
            s_sent = _sentence_at_ms(sentences, int(setup))
            if s_sent is not None:
                start_ms = min(start_ms, int(s_sent.start_ms))
        if payoff is not None:
            p_sent = _sentence_at_ms(sentences, int(payoff))
            if p_sent is not None:
                end_ms = max(end_ms, int(p_sent.end_ms))
            else:
                end_ms = max(end_ms, int(payoff))
        end_ms = min(range_end_ms, end_ms)
        start_ms = max(range_start_ms, start_ms)
        if end_ms <= start_ms:
            return before_start, before_end
    except Exception:
        return start_ms, end_ms
    return start_ms, end_ms


def _pad_end_to_next_word(words: list[dict], we: int, end_ms: int, pad_ms: int, range_end_ms: int) -> int:
    """FIX1: keep a short tail after the last spoken word, but never run into the next word."""
    nxt = int(words[we + 1]["s"] * 1000) - 20 if 0 <= we < len(words) - 1 else range_end_ms
    return min(range_end_ms, max(end_ms, min(end_ms + pad_ms, nxt)))


def _preroll_start_ms(words: list[dict], wi: int, range_start_ms: int, pad_start_ms: int) -> int:
    """FIX2 R5: start just before the first substantive word, never inside the previous word.

    Dead air / a filler right before the word -> exact onset (FIX1 rule, pinned by
    test_start_after_dead_air_does_not_include_silence_pad). Otherwise pre-roll by ``pad_start_ms``,
    stopping 20 ms after the previous word ends.
    """
    w_s = int(words[wi]["s"] * 1000)
    prev_end_ms = int(words[wi - 1]["e"] * 1000) if wi > 0 else range_start_ms
    if wi > 0 and _is_filler_token(words[wi - 1]["w"]):
        return w_s
    if w_s - prev_end_ms >= int(LEADING_DEAD_AIR_S * 1000):
        return w_s
    floor_ms = prev_end_ms + 20 if wi > 0 else range_start_ms
    return min(w_s, max(range_start_ms, floor_ms, w_s - pad_start_ms))


def _snap_ms_out_of_words(
    words: list[dict], start_ms: int, end_ms: int, range_start_ms: int, range_end_ms: int
) -> tuple[int, int]:
    """FIX1: never start or end inside a spoken word (after visual anchors / reaction tail / revert moved a bound)."""
    for i, w in enumerate(words):
        ws, wend = int(w["s"] * 1000), int(w["e"] * 1000)
        if ws < start_ms < wend:
            start_ms = max(range_start_ms, ws)
        if ws < end_ms < wend:
            # FIX2 R5: finish the word (+120 ms tail) but never run into the next word's onset.
            nxt = int(words[i + 1]["s"] * 1000) - 20 if i + 1 < len(words) else range_end_ms
            end_ms = min(range_end_ms, max(wend, min(wend + 120, nxt)))
    return start_ms, end_ms


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

    picked_end_ms = end_ms
    s_start = _sentence_at_ms(sentences, start_ms)
    if s_start:
        gap_pick = start_ms > s_start.end_ms
        next_sent = None
        if gap_pick:
            for s in sentences:
                if s.start_ms > s_start.end_ms:
                    next_sent = s
                    break
        if gap_pick and next_sent is not None and start_ms < next_sent.start_ms:
            start_ms = _advance_to_substantive_start(sentences, next_sent)
            s_start = next_sent
        else:
            start_ms = _advance_to_substantive_start(sentences, s_start)
            s_start = _sentence_at_ms(sentences, start_ms) or s_start

    if not words:
        clip["start_ms"], clip["end_ms"] = start_ms, end_ms
        return clip

    snap_lo = max(range_start_ms, before[0] - SNAP_WORD_WINDOW_MS)
    snap_hi = min(range_end_ms, before[1] + SNAP_WORD_WINDOW_MS)

    wi = _word_index_at_ms(words, start_ms, "start", window_lo_ms=snap_lo, window_hi_ms=snap_hi)
    if wi < 0:
        clip["start_ms"], clip["end_ms"] = before[0], before[1]
        picker_info(
            "snap_reverted",
            reason="no_words_near_start",
            before_start=before[0],
            before_end=before[1],
        )
        return clip
    while wi < len(words) and _is_filler_token(words[wi]["w"]):
        wi += 1
    substantive_wi = wi
    if wi < len(words):
        start_ms = int(words[wi]["s"] * 1000)

    length_limit = _length_limit_ms(clip, range_end_ms)
    we = _word_index_at_ms(words, picked_end_ms, "end", window_lo_ms=snap_lo, window_hi_ms=snap_hi)
    if we < 0:
        clip["start_ms"], clip["end_ms"] = before[0], before[1]
        picker_info(
            "snap_reverted",
            reason="no_words_near_end",
            before_start=before[0],
            before_end=before[1],
        )
        return clip
    while we > wi and _is_filler_token(words[we]["w"]) and _norm_token(words[we]["w"]) not in _END_KEEP:
        we -= 1

    last_final = _sentence_final_word_index_at_or_before(words, we)
    if we < len(words) and not _is_sentence_final_word(words, we):
        if we + 1 < len(words) and words[we + 1]["s"] - words[we]["e"] >= GAP_SENTENCE_END_S:
            we = last_final
    if _is_sentence_final_word(words, we):
        end_ms = int(words[we]["e"] * 1000)
    elif _new_incomplete_sentence_after(words, we, last_final):
        we = last_final
        end_ms = int(words[we]["e"] * 1000)
    else:
        extend_limit = int(picked_end_ms + SENTENCE_EXTEND_MAX_S * 1000)
        extend_limit = min(extend_limit, length_limit, range_end_ms)
        extended = False
        for j in range(we + 1, len(words)):
            if int(words[j]["e"] * 1000) > extend_limit:
                break
            if _is_sentence_final_word(words, j):
                we = j
                end_ms = int(words[we]["e"] * 1000)
                extended = True
                break
        if not extended:
            we = last_final
            end_ms = int(words[we]["e"] * 1000)

    pad_start_ms = int(PAD_START_S * 1000)
    pad_end_ms = int(PAD_END_S * 1000)
    if substantive_wi < len(words):
        start_ms = _preroll_start_ms(words, substantive_wi, range_start_ms, pad_start_ms)  # FIX2 R5
    else:
        start_ms = max(range_start_ms, int(start_ms - pad_start_ms))
    end_ms = _pad_end_to_next_word(words, we, int(end_ms), pad_end_ms, range_end_ms)
    if end_ms <= start_ms:
        start_ms, end_ms = before

    start_ms, end_ms = _apply_visual_boundary_anchors(
        clip,
        words,
        sentences,
        range_start_ms,
        range_end_ms,
        start_ms,
        end_ms,
        before_start=before[0],
        before_end=before[1],
    )

    rend = clip.get("clipfind_reaction_end_ms")
    if rend is not None:
        try:
            from clips_worker.clipfind.flags import clipfind_flag

            if clipfind_flag("CLIPFIND_REACTION_TAIL"):
                cap = min(range_end_ms, start_ms + _length_limit_ms(clip, range_end_ms))
                new_end = max(end_ms, min(cap, int(rend)))
                if new_end != end_ms:
                    picker_info("clipfind_reaction_tail", before_end=end_ms, after_end=new_end)
                end_ms = new_end
        except Exception as exc:
            from clips_worker.clipfind.flags import clipfind_fallback

            clipfind_fallback("snap_reaction_tail", type(exc).__name__, exc=exc)

    start_ms, end_ms = _snap_ms_out_of_words(words, start_ms, end_ms, range_start_ms, range_end_ms)
    clip["start_ms"] = start_ms
    clip["end_ms"] = end_ms

    overlap = _span_overlap_ratio(start_ms, end_ms, before[0], before[1])
    if overlap < SNAP_MIN_OVERLAP_RATIO or (end_ms - start_ms) < SNAP_MIN_SPAN_MS:
        clip["start_ms"], clip["end_ms"] = _snap_ms_out_of_words(
            words, int(before[0]), int(before[1]), range_start_ms, range_end_ms
        )
        picker_info(
            "snap_reverted",
            reason="low_overlap_or_short",
            before_start=before[0],
            before_end=before[1],
            after_start=start_ms,
            after_end=end_ms,
            overlap=round(overlap, 3),
        )
        return clip

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
