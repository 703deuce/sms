"""Line-for-line equivalent of new-app/lib/clips/caption-words.ts."""
from __future__ import annotations

from clips_worker.clip_keep_segments import keep_segments, ordered_keep_segments

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


def is_word_cut_by_ranges(w: dict, cut_ranges: list, *, trim_in: int, trim_out: int) -> bool:
    mid = word_mid_ms(w)
    for a, b in cut_ranges:
        a, b = int(a), int(b)
        if b <= trim_in or a >= trim_out:
            continue
        a = max(a, trim_in)
        b = min(b, trim_out)
        if b <= a:
            continue
        if mid >= a and mid < b:
            return True
    return False


def _resolve_word_text(w: dict, fixes: dict, fix_meta: dict, *, words_fallback: bool) -> str:
    wi = int(w["i"])
    key = str(wi)
    if not words_fallback or not fix_meta:
        return fixes.get(key, w["w"])
    if key in fixes:
        return fixes[key]
    ws = float(w["s"])
    best_key: str | None = None
    best_dt = 0.06
    for fk, meta in fix_meta.items():
        if not isinstance(meta, dict):
            continue
        try:
            ms = float(meta.get("s", -1))
        except (TypeError, ValueError):
            continue
        dt = abs(ms - ws)
        if dt < best_dt:
            best_dt = dt
            best_key = str(fk)
    if best_key and best_key in fixes:
        return fixes[best_key]
    return w["w"]


def build_caption_words(words: list[dict], edits: dict, *, words_fallback: bool = False) -> list[dict]:
    cut_ranges = edits.get("cutRanges") or []
    trim_in = int(edits["trim"]["in"])
    trim_out = int(edits["trim"]["out"])
    fixes = edits.get("wordFixes") or {}
    fix_meta = edits.get("wordFixMeta") or {}
    if words_fallback or edits.get("_wordsFallback"):
        words_fallback = True
    segs = ordered_keep_segments(edits)
    out: list[dict] = []
    for w in words:
        if is_word_cut_by_ranges(w, cut_ranges, trim_in=trim_in, trim_out=trim_out) or is_word_cut_by_ranges(w, edits.get("audioMuteRanges") or [], trim_in=trim_in, trim_out=trim_out):
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
        text = _resolve_word_text({**w, "i": wi}, fixes, fix_meta, words_fallback=words_fallback)
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
