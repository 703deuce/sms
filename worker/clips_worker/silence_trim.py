"""Silence gap cuts (source timeline ms). Mirrors new-app/lib/clips/silence-trim.ts."""


def silence_trim_cuts(words: list[dict], opts: dict) -> list[list[int]]:
    if not opts.get("enabled"):
        return []
    min_gap = int(opts.get("minGapMs") or 600)
    keep = int(opts.get("keepMs") or 150)
    cuts: list[list[int]] = []
    for i in range(len(words) - 1):
        gap_start = int(float(words[i]["e"]) * 1000)
        gap_end = int(float(words[i + 1]["s"]) * 1000)
        gap = gap_end - gap_start
        if gap <= min_gap:
            continue
        remove = gap - keep
        if remove <= 50:
            continue
        mid = gap_start + gap / 2
        cuts.append([int(mid - remove / 2), int(mid + remove / 2)])
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
    if st.get("enabled"):
        extra = silence_trim_cuts(source_words, st)
        return merge_cut_ranges(base + extra)
    return base
