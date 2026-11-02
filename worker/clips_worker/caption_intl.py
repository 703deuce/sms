"""Q4: intl caption scripts — pick bundled Noto ASS font from sample text."""
from __future__ import annotations

import re

RTL_RE = re.compile(r"[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")
CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
CJK_RE = re.compile(r"[\u3040-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]")
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
THAI_RE = re.compile(r"[\u0E00-\u0E7F]")
HEBREW_RE = re.compile(r"[\u0590-\u05FF]")


def ass_font_for_sample(text: str) -> str | None:
    t = str(text or "")
    if not t.strip():
        return None
    if HEBREW_RE.search(t) or re.search(r"[\u0600-\u06FF]", t):
        return "Noto Sans Arabic"
    if DEVANAGARI_RE.search(t):
        return "Noto Sans Devanagari"
    if THAI_RE.search(t):
        return "Noto Sans Thai"
    if CJK_RE.search(t):
        return "Noto Sans CJK JP"
    if CYRILLIC_RE.search(t):
        return "Noto Sans"
    if RTL_RE.search(t):
        return "Noto Sans Arabic"
    return None
