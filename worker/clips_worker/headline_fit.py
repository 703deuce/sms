"""Headline auto-fit — parity with new-app/lib/clips/headline-fit.ts."""
from __future__ import annotations

import re

_MAX_LINES = 4
_MIN_CHARS_PER_LINE = 14
_EMOJI_RE = re.compile(r"([\U0001F300-\U0001FAFF\U00002700-\U000027BF]+)\s*$")


def _wrap_headline_lines_full(body: str, max_chars_per_line: int, max_lines: int = _MAX_LINES) -> list[str]:
    words = body.split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        trial = " ".join(cur + [w]).strip()
        if len(trial) > max_chars_per_line and cur:
            lines.append(" ".join(cur))
            cur = [w]
            if len(lines) >= max_lines:
                break
        else:
            cur.append(w)
    if len(lines) >= max_lines and cur:
        lines[-1] = f"{lines[-1]} {' '.join(cur)}".strip()
    elif cur and len(lines) < max_lines:
        lines.append(" ".join(cur))
    return lines[:max_lines]


def headline_chars_per_line_for_box(box_width_px: int, font_px: int) -> int:
    char_w = max(8.0, font_px * 0.52)
    return max(_MIN_CHARS_PER_LINE, int((box_width_px * 0.94) / char_w))


def fit_headline_display_for_box(
    formatted: str,
    box_width_px: int,
    box_height_px: int,
    *,
    max_bar_frac: float = 0.24,
) -> tuple[list[str], int]:
    trimmed = (formatted or "").strip()
    if not trimmed or box_width_px <= 0 or box_height_px <= 0:
        return [], 12
    m = _EMOJI_RE.search(trimmed)
    emojis = (m.group(1) if m else "")[:2]
    body = trimmed[: m.start()].strip() if m else trimmed
    max_bar_h = max(1, int(box_height_px * max_bar_frac))
    font_px = max(
        12,
        min(int(box_height_px * 0.45), int((box_height_px * 0.52) / 3)),
    )
    lines: list[str] = []
    for _ in range(12):
        cpl = headline_chars_per_line_for_box(box_width_px, font_px)
        lines = _wrap_headline_lines_full(body, cpl, _MAX_LINES)
        line_h = max(1, int(font_px * 1.05))
        total_h = line_h * max(1, len(lines))
        longest = max((len(ln) for ln in lines), default=0)
        if total_h <= max_bar_h and longest <= cpl + 1:
            break
        font_px = max(12, int(font_px * 0.9))
    if emojis and lines:
        lines[-1] = f"{lines[-1]} {emojis}".strip()
    return lines, font_px
