"""Sentence segmentation and speaker labels from word timestamps."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Sentence:
    idx: int
    start_ms: int
    end_ms: int
    speaker: str
    text: str
    word_start: int
    word_end: int


def _assign_speakers(words: list[dict]) -> list[str]:
    spks: list[str] = []
    cur = "A"
    for i, w in enumerate(words):
        if "spk" in w:
            spks.append("A" if int(w["spk"]) == 0 else "B")
            cur = spks[-1]
            continue
        if i > 0 and w["s"] - words[i - 1]["e"] > 0.55:
            cur = "B" if cur == "A" else "A"
        spks.append(cur)
    return spks


def build_sentences(words: list[dict], range_start_ms: int, range_end_ms: int) -> list[Sentence]:
    sliced = [w for w in words if w["e"] * 1000 >= range_start_ms and w["s"] * 1000 <= range_end_ms]
    if not sliced:
        return []
    speakers = _assign_speakers(sliced)
    out: list[Sentence] = []
    buf: list[dict] = []
    buf_spk: list[str] = []
    word_i = 0
    start_word = 0

    def flush():
        nonlocal word_i, start_word, buf, buf_spk
        if not buf:
            return
        text = " ".join(x["w"] for x in buf)
        out.append(
            Sentence(
                idx=len(out),
                start_ms=int(buf[0]["s"] * 1000),
                end_ms=int(buf[-1]["e"] * 1000),
                speaker=buf_spk[0] if buf_spk else "A",
                text=text,
                word_start=start_word,
                word_end=word_i - 1,
            )
        )
        start_word = word_i
        buf = []
        buf_spk = []

    for i, w in enumerate(sliced):
        word_i = i
        prev = sliced[i - 1] if i else None
        gap = w["s"] - prev["e"] if prev else 0
        if buf and (gap > 0.35 or re.search(r"[.?!]$", prev["w"]) if prev else False):
            flush()
        buf.append(w)
        buf_spk.append(speakers[i])
    flush()
    return out
