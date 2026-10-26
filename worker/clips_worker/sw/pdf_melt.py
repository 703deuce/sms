"""PDF line classifier for screenwriting import (pure heuristics, v1)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PdfLine:
    text: str
    x0: float
    page: int = 0


def classify_line(line: PdfLine) -> str:
    t = line.text.strip()
    if not t:
        return "empty"
    if t.startswith(("INT.", "EXT.", "INT./EXT.", "I/E")):
        return "scene_heading"
    if line.x0 >= 5.5 or t.endswith("TO:"):
        return "transition"
    if 3.35 <= line.x0 <= 4.25 and t.isupper():
        return "character"
    if 2.85 <= line.x0 <= 3.15 and t.startswith("("):
        return "parenthetical"
    if 2.35 <= line.x0 <= 2.65:
        return "dialogue"
    return "action"
