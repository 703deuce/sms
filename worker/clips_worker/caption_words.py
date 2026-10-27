"""Line-for-line equivalent of new-app/lib/clips/caption-words.ts."""
from __future__ import annotations


def keep_segments(trim_in: int, trim_out: int, cut_ranges: list) -> list[tuple[int, int]]:
    segs: list[tuple[int, int]] = []
    t = trim_in
    for s, e in sorted(cut_ranges, key=lambda x: x[0]):
        s, e = max(int(s), trim_in), min(int(e), trim_out)
        if e <= t:
            continue
        if s > t:
            segs.append((t, s))
        t = max(t, e)
    if t < trim_out:
        segs.append((t, trim_out))
    return [(a, b) for a, b in segs if b - a >= 80]


def remap_time_ms(t_ms: int, segs: list[tuple[int, int]]) -> int | None:
    acc = 0
    for a, b in segs:
        if a <= t_ms < b:
            return acc + (t_ms - a)
        acc += b - a
    return None


def remap_time_end_ms(t_ms: int, segs: list[tuple[int, int]]) -> int | None:
    acc = 0
    for a, b in segs:
        if a < t_ms <= b:
            return acc + (t_ms - a)
        if a <= t_ms < b:
            return acc + (t_ms - a)
        acc += b - a
    return None


def word_mid_ms(w: dict) -> float:
    return (float(w["s"]) + float(w["e"])) * 500.0


def is_word_cut_by_ranges(w: dict, cut_ranges: list) -> bool:
    mid = word_mid_ms(w)
    for a, b in cut_ranges:
        if mid >= a and mid < b:
            return True
    return False


def build_caption_words(words: list[dict], edits: dict) -> list[dict]:
    cut_ranges = edits.get("cutRanges") or []
    trim_in = int(edits["trim"]["in"])
    trim_out = int(edits["trim"]["out"])
    fixes = edits.get("wordFixes") or {}
    segs = keep_segments(trim_in, trim_out, cut_ranges)
    out: list[dict] = []
    for w in words:
        if is_word_cut_by_ranges(w, cut_ranges):
            continue
        s_ms = int(float(w["s"]) * 1000)
        e_ms = int(float(w["e"]) * 1000)
        mid = (s_ms + e_ms) // 2
        seg = next((s for s in segs if s[0] <= mid < s[1]), None)
        if not seg:
            continue
        a, b = seg
        clamp_start = max(s_ms, a)
        clamp_end = min(e_ms, b)
        if clamp_end - clamp_start < 20:
            continue
        out_s = remap_time_ms(clamp_start, segs)
        out_e = remap_time_end_ms(clamp_end, segs)
        if out_s is None or out_e is None or out_e <= out_s:
            continue
        wi = int(w["i"])
        text = fixes.get(str(wi), w["w"])
        if not str(text or "").strip():
            continue
        row = {"i": wi, "text": text, "s_ms": out_s, "e_ms": out_e}
        if w.get("spk") is not None:
            row["spk"] = w["spk"]
        out.append(row)
    out.sort(key=lambda r: (r["s_ms"], r["i"]))
    for i in range(1, len(out)):
        prev = out[i - 1]
        if out[i]["s_ms"] < prev["s_ms"]:
            out[i]["s_ms"] = prev["e_ms"]
        if out[i]["e_ms"] <= out[i]["s_ms"]:
            out[i]["e_ms"] = out[i]["s_ms"] + 1
    return out


def caption_words_to_render(words: list[dict]) -> list[dict]:
    return [
        {
            "w": c["text"],
            "s": round(c["s_ms"] / 1000.0, 3),
            "e": round(c["e_ms"] / 1000.0, 3),
            "idx": c["i"],
        }
        for c in words
    ]
