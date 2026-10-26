"""Parse SRT cues into word-like timing rows (even spacing inside each cue)."""
from __future__ import annotations

import re


def _ts_to_ms(ts: str) -> int:
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    return int(h) * 3_600_000 + int(m) * 60_000 + int(s) * 1000 + int(ms)


def parse_srt_to_words(srt: str) -> list[dict]:
    blocks = re.split(r"\n\s*\n", srt.strip())
    words: list[dict] = []
    idx = 0
    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if len(lines) < 2:
            continue
        time_line = lines[1] if "-->" in lines[1] else lines[0]
        text_lines = lines[2:] if "-->" in lines[1] else lines[1:]
        if "-->" not in time_line:
            continue
        start_s, end_s = time_line.split("-->")
        start_ms = _ts_to_ms(start_s.strip())
        end_ms = _ts_to_ms(end_s.strip())
        text = " ".join(text_lines).strip()
        if not text:
            continue
        tokens = text.split()
        if not tokens:
            continue
        span = max(1, end_ms - start_ms)
        step = span / len(tokens)
        for i, tok in enumerate(tokens):
            s = int(start_ms + i * step)
            e = int(start_ms + (i + 1) * step)
            words.append({"i": idx, "w": tok, "s_ms": s, "e_ms": e, "spk": "A"})
            idx += 1
    return words
