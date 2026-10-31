"""G3a: manual caption lines (typed / SRT-VTT import / converted auto captions).

edits.captionLines = [{"id", "text", "startMs", "endMs"}] in OUTPUT (edit) ms, like text items.
When present they REPLACE the transcript words for the burned captions only (zoom emphasis,
censor, layout switches keep using the transcript). Each line becomes words time-sliced by
length, tagged with its line index "ln" so captions_ass.chunk_words shows one line per caption.

Line-for-line mirror of new-app/lib/clips/editor/caption-lines.ts (captionLineWords).
"""
from __future__ import annotations

LINE_ID_BASE = 1_000_000
MAX_LINES = 2000
MAX_CHARS = 200
MIN_MS = 100


def _num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
        return None
    return v


def _words_of(text: str) -> list[str]:
    return [w for w in text.replace("\r", "").replace("\n", " ").replace("\t", " ").split(" ") if w]


def normalize_caption_lines(raw) -> list[dict]:
    """Valid lines, sorted by start, overlaps trimmed (a line starts no earlier than the previous end)."""
    if not isinstance(raw, list):
        return []
    rows: list[dict] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        text = " ".join(_words_of(str(r.get("text") or "")))[:MAX_CHARS]
        a, b = _num(r.get("startMs")), _num(r.get("endMs"))
        if not text or a is None or b is None:
            continue
        a, b = max(0, int(round(a))), int(round(b))
        if b - a < MIN_MS:
            continue
        rows.append({"id": str(r.get("id") or ""), "text": text, "startMs": a, "endMs": b})
        if len(rows) >= MAX_LINES:
            break
    rows.sort(key=lambda x: (x["startMs"], x["endMs"]))
    out: list[dict] = []
    prev_end = 0
    for x in rows:
        s = max(x["startMs"], prev_end)
        if x["endMs"] - s < MIN_MS:
            continue
        out.append({**x, "startMs": s})
        prev_end = x["endMs"]
    return out


def caption_line_words(edits: dict) -> list[dict]:
    """CaptionWord rows {i, text, s_ms, e_ms, ln} (output ms) — caption_words.build_caption_words shape."""
    out: list[dict] = []
    for li, line in enumerate(normalize_caption_lines(edits.get("captionLines"))):
        words = _words_of(line["text"])
        total = sum(len(w) + 1 for w in words)
        s, e = line["startMs"], line["endMs"]
        dur = e - s
        acc = 0
        for wi, w in enumerate(words):
            ws = s + (dur * acc) // total
            acc += len(w) + 1
            we = s + (dur * acc) // total
            if we <= ws:
                we = ws + 1
            out.append({"i": LINE_ID_BASE + li * 1000 + wi, "text": w, "s_ms": ws, "e_ms": we, "ln": li})
    return out


def has_caption_lines(edits: dict) -> bool:
    return bool(normalize_caption_lines(edits.get("captionLines")))


def caption_line_render_words(edits: dict) -> list[dict]:
    """Render words {w, s, e, idx, ln} (seconds) — caption_words.caption_words_to_render + ln."""
    return [
        {"w": c["text"], "s": round(c["s_ms"] / 1000.0, 3), "e": round(c["e_ms"] / 1000.0, 3), "idx": c["i"], "ln": c["ln"]}
        for c in caption_line_words(edits)
    ]


def _srt_ts(ms: int) -> str:
    h, rem = divmod(int(ms), 3_600_000)
    m, rem = divmod(rem, 60_000)
    sec, msr = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{msr:03d}"


def build_line_srt(edits: dict) -> str:
    """One SRT cue per caption line (the export's .srt when manual lines are set)."""
    parts: list[str] = []
    for n, line in enumerate(normalize_caption_lines(edits.get("captionLines")), start=1):
        parts += [str(n), f"{_srt_ts(line['startMs'])} --> {_srt_ts(line['endMs'])}", line["text"], ""]
    return "\n".join(parts)
