"""ElevenLabs /with-timestamps character alignment -> Transovo transcript words.

Output word shape matches project.transcriptWords and new-app normalizeTranscriptWord():
{w, s, e, i, spk}. Stable ids: i = scene_slot * WORD_BLOCK + k.
"""
from __future__ import annotations

import math

WORD_BLOCK = 10_000


def words_from_alignment(
    alignment: dict,
    *,
    offset_s: float,
    scene_slot: int,
    spk: int = 0,
) -> list[dict]:
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    words: list[dict] = []
    buf, w_start, w_end = "", None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if buf:
                words.append({"w": buf, "s": w_start, "e": w_end})
            buf, w_start, w_end = "", None, None
            continue
        if not buf:
            w_start = s
        buf += ch
        w_end = e
    if buf:
        words.append({"w": buf, "s": w_start, "e": w_end})
    out = []
    for k, wd in enumerate(words):
        out.append({
            "w": wd["w"],
            "s": round(float(wd["s"]) + offset_s, 3),
            "e": round(float(wd["e"]) + offset_s, 3),
            "i": scene_slot * WORD_BLOCK + k,
            "spk": spk,
        })
    return out


def duration_ms_from_alignment(alignment: dict) -> int:
    ends = alignment.get("character_end_times_seconds") or []
    if not ends:
        return 0
    return int(math.ceil(max(ends) * 1000))
