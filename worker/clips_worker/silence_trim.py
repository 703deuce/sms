"""Silence gap cuts (source timeline ms). Mirrors new-app/lib/clips/silence-trim.ts."""
import re

FILLER_ONLY = re.compile(r"^(um|uh|erm|hmm|mm|mhm)$", re.I)
MAX_SILENCE_GAP_MS = 1500
MAX_SINGLE_CUT_MS = 3000


def filler_word_cuts(words: list[dict]) -> list[list[int]]:
    cuts: list[list[int]] = []
    for w in words:
        text = str(w.get("w", "")).strip()
        if not text or not FILLER_ONLY.match(text):
            continue
        a = int(float(w["s"]) * 1000)
        b = int(float(w["e"]) * 1000)
        if b - a > 30:
            cuts.append([a, b])
    return cuts


def silence_trim_cuts(words: list[dict], opts: dict) -> list[list[int]]:
    if not opts.get("enabled"):
        return []
    min_gap = int(opts.get("minGapMs") or 350)
    keep = int(opts.get("keepMs") or 120)
    max_gap = int(opts.get("maxGapMs") or MAX_SILENCE_GAP_MS)
    protect = bool(opts.get("protectReactionGaps"))
    cuts: list[list[int]] = []
    for i in range(len(words) - 1):
        gap_start = int(float(words[i]["e"]) * 1000)
        gap_end = int(float(words[i + 1]["s"]) * 1000)
        gap = gap_end - gap_start
        if protect and gap < min_gap + 200:
            continue
        if gap <= min_gap or gap > max_gap:
            continue
        remove = gap - keep
        if remove <= 50:
            continue
        remove = min(remove, MAX_SINGLE_CUT_MS)
        mid = gap_start + gap / 2
        raw = [int(mid - remove / 2), int(mid + remove / 2)]
        from clips_worker.word_cut import snap_cut_range_to_word_gaps

        snapped = snap_cut_range_to_word_gaps(raw, words)
        if snapped:
            cuts.append(snapped)
    return cuts


def merge_cut_ranges(cuts: list) -> list[list[int]]:
    pairs = [[int(c[0]), int(c[1])] for c in cuts if c and len(c) >= 2]
    pairs.sort(key=lambda x: x[0])
    out: list[list[int]] = []
    for s, e in pairs:
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out


def effective_cut_ranges(edits: dict, source_words: list[dict]) -> list:
    base = list(edits.get("cutRanges") or [])
    st = edits.get("silenceTrim") or {}
    trim = edits.get("trim") or {}
    t_in = int(trim.get("in", 0))
    t_out = int(trim.get("out", 10**12))
    words_in = [w for w in source_words if t_in <= float(w["s"]) * 1000 < t_out]
    if st.get("enabled"):
        extra = silence_trim_cuts(words_in, st)
        if st.get("fillerTrim", True):
            extra = extra + filler_word_cuts(words_in)
        from clips_worker.word_cut import sanitize_cut_ranges

        merged = merge_cut_ranges(base + extra)
        return sanitize_cut_ranges(merged, words_in or source_words)
    from clips_worker.word_cut import sanitize_cut_ranges

    return sanitize_cut_ranges(base, words_in or source_words)
