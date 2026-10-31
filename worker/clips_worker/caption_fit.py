"""E3fix: width-aware caption lines for burned-in ASS (libass WrapStyle 2 never wraps).

The editor preview lays caption words out with CSS flex-wrap, so a long chunk wraps onto a
second line there. The export ASS uses ``WrapStyle: 2`` (no automatic wrapping), so the same
chunk was drawn as one centred line wider than the frame and clipped at both edges
("Energy, capital, whateve"). ``fit_caption_line`` measures the chunk with the bundled font
advance tables (same source TTFs as new-app/lib/clips/font-metrics) and returns explicit
``\\N`` break points plus, only when a single word is still too wide, a uniform shrink.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

_METRICS_PATH = Path(__file__).resolve().parent / "caption_font_metrics.json"
_EMOJI_ADV_EM = 1.25
# Unknown fonts (T6 set without bundled tables) measure as Montserrat Black — the widest
# bundled face — so a long line wraps early rather than clipping.
_FALLBACK_FONT = "Montserrat Black"
_FONT_ALIASES = {
    "Montserrat": "Montserrat Black",
    "Poppins": "Poppins ExtraBold",
}
# Kerning is ignored; keep a small slack so a measured "fits" really fits.
_SLACK = 0.97
_SCALE_TAG_RE = re.compile(r"\\fsc([xy])(\d+(?:\.\d+)?)")


@lru_cache(maxsize=1)
def _all_metrics() -> dict:
    try:
        return json.loads(_METRICS_PATH.read_text())
    except (OSError, ValueError):
        return {}


def _metrics(font: str | None) -> dict | None:
    allm = _all_metrics()
    name = _FONT_ALIASES.get(str(font or ""), str(font or ""))
    return allm.get(name) or allm.get(_FALLBACK_FONT)


def _is_emoji(cp: int) -> bool:
    return 0x1F300 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF


def text_width_px(text: str, font: str | None, fontsize: float) -> float:
    """Rendered advance width of ``text`` in PlayRes px at ASS ``Fontsize`` (no kerning)."""
    m = _metrics(font)
    if not m:
        return len(text) * float(fontsize) * 0.62
    upm = float(m["unitsPerEm"])
    adv = m["adv"]
    default = float(m["defaultAdv"])
    units = 0.0
    for ch in text:
        cp = ord(ch)
        units += _EMOJI_ADV_EM * upm if _is_emoji(cp) else float(adv.get(str(cp), default))
    return units / upm * float(fontsize) * float(m["assEmPerFontsize"])


def fit_caption_line(
    words: list[str],
    *,
    font: str | None,
    fontsize: float,
    max_width_px: float,
    peak_scale: float = 1.0,
    pad_px: float = 0.0,
    max_lines: int = 2,
) -> tuple[list[int], float]:
    """Return ``(breaks, scale)`` for one caption chunk.

    ``breaks`` are word indexes that start a new line (``\\N`` before them). ``scale`` is 1.0
    unless the widest resulting line still exceeds ``max_width_px``; then it is the uniform
    factor that makes it fit. ``peak_scale`` covers pop / emphasis \\fscx growth; ``pad_px``
    covers outline / box padding on both sides.
    """
    if not words or max_width_px <= 0 or fontsize <= 0:
        return [], 1.0
    budget = max(1.0, float(max_width_px) * _SLACK - 2.0 * float(pad_px))
    peak = max(1.0, float(peak_scale))
    space = text_width_px(" ", font, fontsize)

    def w(i: int) -> float:
        return text_width_px(words[i], font, fontsize) * peak

    full = sum(w(i) for i in range(len(words))) + space * peak * (len(words) - 1)
    if full <= budget:
        return [], 1.0

    breaks: list[int] = []
    line_w = 0.0
    widths: list[float] = []
    for i in range(len(words)):
        wi = w(i)
        if i == 0:
            line_w = wi
            continue
        trial = line_w + space * peak + wi
        if trial > budget and len(breaks) + 1 < max_lines:
            breaks.append(i)
            widths.append(line_w)
            line_w = wi
        else:
            line_w = trial
    widths.append(line_w)
    widest = max(widths)
    scale = 1.0 if widest <= budget else max(0.4, budget / widest)
    return breaks, round(scale, 3)


def join_caption_parts(parts: list[str], breaks: list[int]) -> str:
    """Join per-word ASS fragments with spaces, ``\\N`` before each break index."""
    if not breaks:
        return " ".join(parts)
    out = ""
    brk = set(breaks)
    for i, p in enumerate(parts):
        if i == 0:
            out = p
        elif i in brk:
            out += "\\N" + p
        else:
            out += " " + p
    return out


def apply_line_scale(text: str, scale: float) -> str:
    """Uniformly shrink one ASS line: base \\fscx/\\fscy prefix and every explicit scale tag."""
    if scale >= 0.999:
        return text

    def _mul(m: re.Match) -> str:
        return f"\\fsc{m.group(1)}{int(round(float(m.group(2)) * scale))}"

    pct = int(round(100 * scale))
    return f"{{\\fscx{pct}\\fscy{pct}}}" + _SCALE_TAG_RE.sub(_mul, text)
