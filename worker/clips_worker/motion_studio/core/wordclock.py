"""Part 1 / ST-BLK-01..03, ST-RW-001: script model, spoken-form normalisation, word clock, beat table, lint.

Shared core: no documentary-specific logic (ST-ENG-005).

Script line: {id, text (display, verbatim for user scripts), spoken (TTS form), hero?, typed?, chapterId?}
Word table : [{w, s, e, i, line}]  s/e seconds on the narration clock, i = global word index (ClipWord idx).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable

# ------------------------------------------------------------------ spoken-form numbers (ST-RW-001)
_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
         "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
_ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth",
        "twelve": "twelfth"}
_SCALES = [(10**12, "trillion"), (10**9, "billion"), (10**6, "million"), (1000, "thousand")]
_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
           "november", "december"]


def int_words(n: int) -> str:
    if n < 0:
        return "minus " + int_words(-n)
    if n < 20:
        return _ONES[n]
    if n < 100:
        t, o = divmod(n, 10)
        return _TENS[t] + ("-" + _ONES[o] if o else "")
    if n < 1000:
        h, r = divmod(n, 100)
        return _ONES[h] + " hundred" + (" and " + int_words(r) if r else "")
    for v, name in _SCALES:
        if n >= v:
            q, r = divmod(n, v)
            return int_words(q) + " " + name + ((" and " if r < 100 else " ") + int_words(r) if r else "")
    return str(n)


def year_words(y: int) -> str:
    if 2000 <= y <= 2009:
        return int_words(y)
    if 1100 <= y <= 2099:
        hi, lo = divmod(y, 100)
        if lo == 0:
            return int_words(hi) + " hundred"
        return int_words(hi) + " " + (("oh " + _ONES[lo]) if lo < 10 else int_words(lo))
    return int_words(y)


def ordinal_words(n: int) -> str:
    w = int_words(n)
    head, _, last = w.rpartition(" ") if " " in w else ("", "", w)
    hy_head, hy, hy_last = last.rpartition("-")
    tail = hy_last if hy else last
    if tail in _ORD:
        tail = _ORD[tail]
    elif tail.endswith("y"):
        tail = tail[:-1] + "ieth"
    else:
        tail += "th"
    last = (hy_head + "-" + tail) if hy else tail
    return (head + " " + last).strip()


def _num_words(num: str) -> str:
    num = num.replace(",", "")
    if "." in num:
        a, b = num.split(".", 1)
        return int_words(int(a or 0)) + " point " + " ".join(_ONES[int(d)] for d in b if d.isdigit())
    return int_words(int(num))


_SCALE_WORD = {"k": "thousand", "m": "million", "b": "billion", "bn": "billion", "t": "trillion"}


def spoken_form(text: str) -> str:
    """Display text -> TTS text. Meaning-preserving (numbers, money, percent, years, ordinals, dates)."""
    s = text

    def money(m: re.Match) -> str:
        num, scale = m.group(1), (m.group(2) or "").lower()
        words = _num_words(num)
        if scale:
            return f"{words} {_SCALE_WORD.get(scale, scale)} dollars"
        return words + (" dollar" if num.replace(",", "") in ("1", "1.0") else " dollars")

    s = re.sub(r"\$\s?(\d[\d,]*(?:\.\d+)?)\s?(bn|[kmbt])?\b", money, s, flags=re.I)
    s = re.sub(r"(\d[\d,]*(?:\.\d+)?)\s?%", lambda m: _num_words(m.group(1)) + " percent", s)
    s = re.sub(r"\b(\d{1,2})(st|nd|rd|th)\b", lambda m: ordinal_words(int(m.group(1))), s)

    def date(m: re.Match) -> str:
        return f"{m.group(1)} {ordinal_words(int(m.group(2)))}"
    s = re.sub(r"\b(" + "|".join(mo.capitalize() for mo in _MONTHS) + r")\s+(\d{1,2})\b(?!\d)", date, s)
    s = re.sub(r"\b(1[1-9]\d\d|20\d\d)s\b", lambda m: year_words(int(m.group(1))).rsplit(" ", 1)[0] + " " +
               (year_words(int(m.group(1))).rsplit(" ", 1)[-1].replace("y", "ie") + "s"
                if year_words(int(m.group(1))).endswith("y") else year_words(int(m.group(1))).rsplit(" ", 1)[-1] + "s"), s)
    s = re.sub(r"\b(1[1-9]\d\d|20\d\d)\b", lambda m: year_words(int(m.group(1))), s)
    s = re.sub(r"\b\d[\d,]*(?:\.\d+)?\b", lambda m: _num_words(m.group(0)), s)
    return re.sub(r"\s+", " ", s).strip()


# ------------------------------------------------------------------ script model
@dataclass
class Line:
    id: str
    text: str
    spoken: str
    hero: str = ""
    typed: str = ""
    chapter_id: str = ""


@dataclass
class Script:
    lines: list[Line] = field(default_factory=list)

    @classmethod
    def from_json(cls, rows: Iterable[dict]) -> "Script":
        out = []
        for i, r in enumerate(rows):
            text = str(r.get("text") or "").strip()
            if not text:
                continue
            out.append(Line(id=str(r.get("id") or f"l{i + 1}"), text=text,
                            spoken=str(r.get("spoken") or spoken_form(text)).strip(),
                            hero=str(r.get("hero") or ""), typed=str(r.get("typed") or ""),
                            chapter_id=str(r.get("chapterId") or r.get("chapter_id") or "")))
        return cls(out)

    def to_json(self) -> list[dict]:
        return [{"id": l.id, "text": l.text, "spoken": l.spoken, "hero": l.hero, "typed": l.typed,
                 "chapterId": l.chapter_id} for l in self.lines]

    def word_count(self) -> int:
        return sum(len(l.spoken.split()) for l in self.lines)


def split_sentences(text: str) -> list[str]:
    """User script -> lines without changing a word (WF-B: verbatim)."""
    parts: list[str] = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = " ".join(para.split())
        if not para:
            continue
        chunks = re.split(r"(?<=[.!?])\s+(?=[\"'A-Z0-9])", para)
        parts.extend(c.strip() for c in chunks if c.strip())
    return parts


def typed_spoken_lint(script: Script) -> list[dict]:
    """ST-RW-001: flag a phrase that is typed on screen and spoken word for word."""
    out = []
    for l in script.lines:
        typed = (l.typed or l.hero or "").strip()
        if not typed:
            continue
        norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower()).split()  # noqa: E731
        t, sp = norm(typed), norm(l.spoken)
        if len(t) >= 3:
            for i in range(len(sp) - len(t) + 1):
                if sp[i:i + len(t)] == t:
                    out.append({"lineId": l.id, "issue": f"typed and spoken word for word: {typed!r}"})
                    break
    return out


# ------------------------------------------------------------------ word clock
def _norm(w: str) -> str:
    return re.sub(r"[^a-z0-9']", "", w.lower())


class WordClockMiss(KeyError):
    pass


class WordClock:
    """ST-BLK-02 W(line, word, nth, end): resolve a spoken word to a time. Fails loudly on a miss."""

    def __init__(self, words: list[dict], lines: list[Line] | None = None):
        self.words = sorted(words, key=lambda w: (w["s"], w.get("i", 0)))
        self.by_line: dict[str, list[dict]] = {}
        for w in self.words:
            self.by_line.setdefault(str(w.get("line", "")), []).append(w)
        self.lines = lines or []

    def W(self, line: str, word: str, nth: int = 0, end: bool = False) -> float:
        target = _norm(word)
        seen = 0
        for w in self.by_line.get(str(line), []):
            if _norm(w["w"]) == target or (target and _norm(w["w"]).startswith(target) and len(target) >= 4):
                if seen == nth:
                    return float(w["e"] if end else w["s"])
                seen += 1
        raise WordClockMiss(f"word {word!r} (occurrence {nth}) not spoken in line {line!r}")

    def line_span(self, line: str) -> tuple[float, float]:
        ws = self.by_line.get(str(line))
        if not ws:
            raise WordClockMiss(f"line {line!r} has no timed words")
        return float(ws[0]["s"]), float(ws[-1]["e"])

    def duration(self) -> float:
        return float(self.words[-1]["e"]) if self.words else 0.0


def beat_table(script: Script, clock: WordClock) -> list[dict]:
    """ST-BLK-03: per line start/end + hero word time (real word timings)."""
    out = []
    for l in script.lines:
        try:
            s, e = clock.line_span(l.id)
        except WordClockMiss:
            continue
        hero_t = None
        if l.hero:
            first = (spoken_form(l.hero).split() or [''])[0]
            try:
                hero_t = clock.W(l.id, first)
            except WordClockMiss:
                hero_t = None
        out.append({"lineId": l.id, "start": round(s, 3), "end": round(e, 3), "hero": l.hero or None,
                    "heroT": None if hero_t is None else round(hero_t, 3), "words": len(l.spoken.split())})
    return out


def articulation_wpm(words: list[dict]) -> float:
    if not words:
        return 0.0
    speaking = sum(max(0.0, w["e"] - w["s"]) for w in words)
    total = words[-1]["e"] - words[0]["s"]
    return round(len(words) / max(1e-6, total) * 60.0, 1) if speaking > 0 else 0.0


def estimate_words(script: Script, wps: float = 2.05, line_gap: float = 0.45) -> list[dict]:
    """Estimated timings before a voice exists (ST-BLK-03: replaced by real timings after narration)."""
    t = 0.3
    out: list[dict] = []
    i = 0
    for l in script.lines:
        for tok in l.spoken.split():
            d = max(0.18, len(re.sub(r"[^a-zA-Z0-9]", "", tok)) * 0.065 + 0.08) / (wps / 2.05)
            out.append({"w": tok, "s": round(t, 3), "e": round(t + d, 3), "i": i, "line": l.id})
            t += d + 0.03
            i += 1
        t += line_gap + (0.25 if tok.endswith(("...", "…")) else 0.0)
    return out


def align_words_to_lines(words: list[dict], script: Script) -> list[dict]:
    """Attach a line id to ASR/TTS words by walking the spoken tokens in order (tolerant of small drift)."""
    tokens: list[tuple[str, str]] = []
    for l in script.lines:
        for tok in l.spoken.split():
            tokens.append((_norm(tok), l.id))
    out = []
    j = 0
    for k, w in enumerate(words):
        nw = _norm(w.get("w", ""))
        best = None
        for d in range(0, 6):
            if j + d < len(tokens) and tokens[j + d][0] == nw:
                best = j + d
                break
        if best is not None:
            j = best + 1
            line = tokens[best][1]
        else:
            line = tokens[min(j, len(tokens) - 1)][1] if tokens else ""
        row = dict(w)
        row["line"] = line
        row.setdefault("i", k)
        out.append(row)
    return out


def to_clip_words(words: list[dict], offset_s: float = 0.0) -> list[dict[str, Any]]:
    """Word table -> ClipWord JSON for the editor ({w,s,e,i,spk}, seconds)."""
    return [{"w": w["w"], "s": round(w["s"] + offset_s, 3), "e": round(w["e"] + offset_s, 3), "i": k, "spk": 0}
            for k, w in enumerate(words)]
