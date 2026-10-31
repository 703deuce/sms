"""EP1: template title — ONE measured line-breaking method + ASS, shared with the editor preview.

Mirror (byte-identical .ass, goldens in tests/fixtures/render_plan): new-app/lib/clips/render-plan/title-ass.ts.
Replaces two different algorithms (preview: one line + font shrink; export: char-count wrap) that put
the title on 1 line in the editor but 2 in the export. Widths come from caption_font_metrics.json
(the same advance tables the caption fit uses), so both sides pick the same lines and Fontsize.

Fit: for n = 1..3 lines, the word split that minimises the widest line (ties → earliest split); its
Fontsize is the largest that fits the text box width and n lines in the box height; the n with the
largest Fontsize wins (ties → fewer lines).
"""
from __future__ import annotations

from itertools import combinations
from pathlib import Path

from clips_worker.caption_fit import text_width_px

TITLE_MAX_LINES = 3
TITLE_WIDTH_SLACK = 0.96  # libass Bold=1 embolden + side bearings
TITLE_HEIGHT_FRAC = 0.72  # n lines · Fontsize ≤ 72 % of the box (libass line height = Fontsize)
TITLE_ONE_LINE_EM_FRAC = 0.34  # cap: em ≤ 0.34 · box height (short titles stay one modest line)
TITLE_MIN_FONTSIZE = 10
_REF_FS = 100.0
# libass memory-font names (name ID 1) — fontconfig resolves these too (EP1 canonical names).
_TITLE_FONTS = {
    "anton": "Anton",
    "montserrat": "Montserrat Black",
    "poppins": "Poppins ExtraBold",
}


def clip_fonts_dir() -> Path | None:
    """Pinned bundled fonts (Anton / Montserrat Black / Poppins ExtraBold) for ``ass=…:fontsdir``."""
    for p in (Path("/app/v3/fonts"), Path(__file__).resolve().parent.parent / "prototype" / "v3" / "fonts"):
        if (p / "Anton-Regular.ttf").is_file():
            return p
    return None


def title_font_name(style: dict | None) -> str:
    raw = str((style or {}).get("font") or "").strip().lower()
    for k, v in _TITLE_FONTS.items():
        if k in raw:
            return v
    return "Anton"


def _em_per_fontsize(font: str) -> float:
    from clips_worker.caption_fit import _metrics

    m = _metrics(font) or {}
    return float(m.get("assEmPerFontsize") or 0.714286)


def _best_split(words: list[str], n: int, font: str) -> tuple[list[str], float]:
    best: tuple[list[str], float] | None = None
    for cuts in combinations(range(1, len(words)), n - 1):
        bounds = (0, *cuts, len(words))
        lines = [" ".join(words[bounds[i] : bounds[i + 1]]) for i in range(n)]
        widest = max(text_width_px(ln, font, _REF_FS) for ln in lines)
        if best is None or widest < best[1]:
            best = (lines, widest)
    assert best is not None
    return best


def fit_title(text: str, font: str, box_w: int, box_h: int) -> tuple[list[str], int]:
    """(lines, ASS Fontsize) for ``text`` in a ``box_w`` × ``box_h`` text box (PlayRes px)."""
    words = str(text or "").split()
    if not words or box_w <= 0 or box_h <= 0:
        return [], TITLE_MIN_FONTSIZE
    cap = box_h * TITLE_ONE_LINE_EM_FRAC / _em_per_fontsize(font)
    best_lines: list[str] = []
    best_fs = -1
    for n in range(1, min(TITLE_MAX_LINES, len(words)) + 1):
        lines, widest = _best_split(words, n, font)
        fs_w = box_w * TITLE_WIDTH_SLACK * _REF_FS / widest if widest > 0 else cap
        fs_v = box_h * TITLE_HEIGHT_FRAC / n
        fs = int(min(fs_w, fs_v, cap))
        if fs > best_fs:
            best_lines, best_fs = lines, fs
    return best_lines, max(TITLE_MIN_FONTSIZE, best_fs)


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def _ass_color(hex_color: str) -> str:
    c = (hex_color or "").strip().lstrip("#")
    if len(c) >= 6:
        return f"&H00{c[4:6]}{c[2:4]}{c[0:2]}".upper()
    return "&H00FFFFFF"


def _ts(ms: int) -> str:
    cs = max(1, int(ms)) // 10
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, c = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{c:02d}"


def title_text_box(rect: dict, kind: str) -> tuple[int, int, int, int]:
    """(x, y, w, h) of the text box inside the title rect (matches _t6_title_burn's backgrounds)."""
    x, y, w, h = int(rect["x"]), int(rect["y"]), int(rect["w"]), int(rect["h"])
    pad = int(w * 0.06)
    if kind == "box":
        bh = int(h * 0.72)
        return x + pad, y + (h - bh) // 2, w - 2 * pad, bh
    return x + pad, y, w - 2 * pad, h


def title_ass_content(
    text: str,
    *,
    play_w: int,
    play_h: int,
    rect: dict,
    kind: str,
    text_color: str,
    font: str,
    duration_ms: int,
) -> str:
    """Template title .ass (text only; the band / blur / box background is drawn separately)."""
    tx, ty, tw, th = title_text_box(rect, kind)
    lines, fs = fit_title(text, font, tw, th)
    primary = _ass_color(text_color)
    body = r"\N".join(_esc(ln) for ln in lines)
    cx = tx + tw // 2
    cy = ty + th // 2
    return (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {play_w}\nPlayResY: {play_h}\n"
        "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        f"Style: Title,{font},{fs},{primary},{primary},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        f"Dialogue: 0,0:00:00.00,{_ts(duration_ms)},Title,,0,0,0,,{{\\an5\\pos({cx},{cy})}}{body}\n"
    )
