"""G3a: manual caption lines (typed / SRT-VTT import / converted auto captions).

edits.captionLines = [{"id", "text", "startMs", "endMs"}] in OUTPUT (edit) ms, like text items.
When present they REPLACE the transcript words for the burned captions only (zoom emphasis,
censor, layout switches keep using the transcript). Each line becomes words time-sliced by
length, tagged with its line index "ln" so captions_ass.chunk_words shows one line per caption.

Line-for-line mirror of new-app/lib/clips/editor/caption-lines.ts (captionLineWords).
"""
from __future__ import annotations
import math

LINE_ID_BASE = 1_000_000
MAX_LINES = 2000
MAX_CHARS = 200
MIN_MS = 100


def _num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
        return None
    return v


MAX_TEXT_LINES = 3  # G3afix: a cue keeps up to 3 of its own lines; extra lines join the last one
_OPEN = {"<i>": "it", "<b>": "bo"}
_CLOSE = {"</i>": "it", "</b>": "bo"}


def _words_of(text: str) -> list[str]:
    return [t["w"] for t in line_tokens(text)]


def line_tokens(text: str) -> list[dict]:
    """G3afix: words of a caption line {w, br, it, bo}.

    ``br`` = the word starts a new line of the cue ("\n"); ``it``/``bo`` = inside <i>/<b> (the
    style at the word's first character; tags never split a word). Other text is literal.
    Mirror of caption-lines.ts lineTokens.
    """
    state = {"it": False, "bo": False}
    out: list[dict] = []
    lines_seen = 1
    for li, line in enumerate(str(text or "").replace("\r", "").split("\n")):
        br = li > 0 and bool(out)
        cur: dict | None = None
        pos = 0
        while pos < len(line):
            t4, t3 = line[pos : pos + 4].lower(), line[pos : pos + 3].lower()
            if t3 in _OPEN:
                state[_OPEN[t3]] = True
                pos += 3
                continue
            if t4 in _CLOSE:
                state[_CLOSE[t4]] = False
                pos += 4
                continue
            ch = line[pos]
            pos += 1
            if ch in (" ", "\t"):
                cur = None
                continue
            if cur is None:
                nb = br and lines_seen < MAX_TEXT_LINES
                if nb:
                    lines_seen += 1
                cur = {"w": "", "br": nb, "it": state["it"], "bo": state["bo"]}
                br = False
                out.append(cur)
            cur["w"] += ch
    return out


def serialize_tokens(tokens: list[dict], max_chars: int | None = None) -> str:
    """Canonical text for tokens ("\n" between cue lines, balanced <b>/<i>), cut after max_chars
    plain characters (separators count) like the old " ".join(words)[:MAX_CHARS]."""
    out = ""
    it = bo = False
    left = max_chars if max_chars is not None else 1 << 30
    for k, t in enumerate(tokens):
        if left <= 0:
            break
        if it and not t["it"]:
            out += "</i>"
            it = False
        if bo and not t["bo"]:
            out += "</b>"
            bo = False
        if k:
            out += "\n" if t["br"] else " "
            left -= 1
            if left <= 0:
                break
        if t["bo"] and not bo:
            out += "<b>"
            bo = True
        if t["it"] and not it:
            out += "<i>"
            it = True
        w = t["w"][:left]
        out += w
        left -= len(w)
    if it:
        out += "</i>"
    if bo:
        out += "</b>"
    return out


def plain_text(text: str) -> str:
    """Text without tags (TXT export, reading time)."""
    return "\n".join(" ".join(t["w"] for t in seg) for seg in _split_lines(line_tokens(text)))


def _split_lines(tokens: list[dict]) -> list[list[dict]]:
    segs: list[list[dict]] = []
    for t in tokens:
        if not segs or t["br"]:
            segs.append([])
        segs[-1].append(t)
    return segs



def _plain_len(tokens: list[dict]) -> int:
    return sum((1 if k else 0) + len(t["w"]) for k, t in enumerate(tokens))


def _token_span_chars(tokens: list[dict]) -> int:
    """Visible characters plus separators, matching serialize_tokens / tokenSpanChars."""
    return _plain_len(tokens)


def _js_round(x: float) -> int:
    """Match Math.round (half away from zero / half up for positives)."""
    return int(math.floor(x + 0.5)) if x >= 0 else int(math.ceil(x - 0.5))


def _proportional_spans(weights: list[int], start_ms: int, end_ms: int) -> list[tuple[int, int]]:
    """Time-slice groups by character weight, matching caption-lines.ts proportionalSpans."""
    total = sum(weights) or 1
    dur = end_ms - start_ms
    out: list[tuple[int, int]] = []
    acc = 0
    for i, w in enumerate(weights):
        s = start_ms + _js_round((dur * acc) / total)
        acc += w
        e = end_ms if i == len(weights) - 1 else start_ms + _js_round((dur * acc) / total)
        out.append((s, max(e, s)))
    return out


def _split_tokens_max_chars(tokens: list[dict], max_chars: int = MAX_CHARS) -> list[list[dict]]:
    """Pack tokens into groups of at most max_chars visible characters.

    Never cuts inside a token. A single token longer than max_chars stays
    intact as its own group. Mirror of caption-lines.ts splitTokensByMaxChars.
    """
    groups: list[list[dict]] = []
    current: list[dict] = []
    for t in tokens:
        if not current:
            current = [{**t, "br": False}]
            continue
        nxt = current + [t]
        if _token_span_chars(nxt) > max_chars:
            groups.append(current)
            current = [{**t, "br": False}]
        else:
            current = nxt
    if current:
        groups.append(current)
    return groups


def _merge_text(prev: dict, nxt: dict) -> str:
    return serialize_tokens(line_tokens(prev["text"]) + line_tokens(nxt["text"]))


def _merge_short_pieces(pieces: list[dict]) -> list[dict]:
    """Merge any piece under MIN_MS into its neighbor, the way rechunkCaptionLines does.
    Also merge a leading short piece into the next neighbor so words are never dropped."""
    merged: list[dict] = []
    for x in pieces:
        prev = merged[-1] if merged else None
        if prev is not None and x["endMs"] - x["startMs"] < MIN_MS and prev["endMs"] == x["startMs"]:
            merged[-1] = {**prev, "text": _merge_text(prev, x), "endMs": x["endMs"]}
        else:
            merged.append(x)
    out: list[dict] = []
    i = 0
    while i < len(merged):
        x = merged[i]
        nxt = merged[i + 1] if i + 1 < len(merged) else None
        if nxt is not None and x["endMs"] - x["startMs"] < MIN_MS and x["endMs"] == nxt["startMs"]:
            out.append({**x, "text": _merge_text(x, nxt), "endMs": nxt["endMs"], "glue_left": x.get("glue_left")})
            i += 2
            continue
        out.append(x)
        i += 1
    return out


def _split_oversized_line(line: dict) -> list[dict]:
    """If a cue's plain text exceeds MAX_CHARS, split on word boundaries and time-slice
    like rechunkCaptionLines / splitTokensByMaxChars. A single over-long token stays whole.
    Pieces under MIN_MS are merged into a neighbor; words are never dropped."""
    toks = line_tokens(line["text"])
    if _plain_len(toks) <= MAX_CHARS:
        return [line]
    chunks = _split_tokens_max_chars(toks)
    if len(chunks) <= 1:
        return [line]
    weights = [max(1, _token_span_chars(part)) for part in chunks]
    spans = _proportional_spans(weights, line["startMs"], line["endMs"])
    base_id = str(line.get("id") or "")
    pieces: list[dict] = []
    for i, part in enumerate(chunks):
        a, b = spans[i]
        pieces.append({
            "id": base_id if i == 0 or not base_id else f"{base_id}~{i}",
            "text": serialize_tokens(part),
            "startMs": a,
            "endMs": b,
        })
    return _merge_short_pieces(pieces)


def normalize_caption_lines(raw) -> list[dict]:
    """Valid lines, sorted by start, overlaps trimmed (a line starts no earlier than the previous end)."""
    if not isinstance(raw, list):
        return []
    rows: list[dict] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        # Keep the full text here; oversized cues are split below instead of truncated.
        text = serialize_tokens(line_tokens(str(r.get("text") or "")))
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
    split: list[dict] = []
    for line in rows:
        for piece in _split_oversized_line(line):
            split.append(piece)
            if len(split) >= MAX_LINES:
                break
        if len(split) >= MAX_LINES:
            break
    split = _merge_short_pieces(split)
    out: list[dict] = []
    prev_end = 0
    for x in split:
        s = max(x["startMs"], prev_end)
        if x["endMs"] - s < MIN_MS:
            # After overlap trim, merge a leftover under 100 ms into its neighbor
            # instead of dropping it, matching caption-lines.ts.
            if out:
                prev = out[-1]
                out[-1] = {**prev, "text": _merge_text(prev, x), "endMs": max(prev["endMs"], x["endMs"])}
                prev_end = max(prev_end, x["endMs"])
            else:
                out.append(dict(x))
                prev_end = x["endMs"]
            continue
        out.append({**x, "startMs": s})
        prev_end = x["endMs"]
    return out


def caption_line_words(edits: dict) -> list[dict]:
    """CaptionWord rows {i, text, s_ms, e_ms, ln[, br, it, bo]} (output ms) — build_caption_words shape."""
    out: list[dict] = []
    for li, line in enumerate(normalize_caption_lines(edits.get("captionLines"))):
        toks = line_tokens(line["text"])
        total = sum(len(t["w"]) + 1 for t in toks)
        s, e = line["startMs"], line["endMs"]
        dur = e - s
        acc = 0
        for wi, t in enumerate(toks):
            w = t["w"]
            ws = s + (dur * acc) // total
            acc += len(w) + 1
            we = s + (dur * acc) // total
            if we <= ws:
                we = ws + 1
            row = {"i": LINE_ID_BASE + li * 1000 + wi, "text": w, "s_ms": ws, "e_ms": we, "ln": li}
            for k in ("br", "it", "bo"):
                if t[k]:
                    row[k] = True
            out.append(row)
    return out


def has_caption_lines(edits: dict) -> bool:
    return bool(normalize_caption_lines(edits.get("captionLines")))


def caption_line_render_words(edits: dict) -> list[dict]:
    """Render words {w, s, e, idx, ln} (seconds) — caption_words.caption_words_to_render + ln."""
    out: list[dict] = []
    for c in caption_line_words(edits):
        row = {"w": c["text"], "s": round(c["s_ms"] / 1000.0, 3), "e": round(c["e_ms"] / 1000.0, 3), "idx": c["i"], "ln": c["ln"]}
        for k in ("br", "it", "bo"):
            if c.get(k):
                row[k] = True
        out.append(row)
    return out


def _srt_ts(ms: int) -> str:
    h, rem = divmod(int(ms), 3_600_000)
    m, rem = divmod(rem, 60_000)
    sec, msr = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{msr:03d}"


def build_line_srt(edits: dict) -> str:
    """One SRT cue per caption line (the export's .srt when manual lines are set); the cue keeps its
    own line breaks and <i>/<b> (G3afix)."""
    parts: list[str] = []
    for n, line in enumerate(normalize_caption_lines(edits.get("captionLines")), start=1):
        parts += [str(n), f"{_srt_ts(line['startMs'])} --> {_srt_ts(line['endMs'])}", line["text"], ""]
    return "\n".join(parts)
