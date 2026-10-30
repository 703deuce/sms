"""Stream export headline bar (ASS) — Montserrat + Noto Color Emoji."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

_EMOJI_RE = re.compile(r"([\U0001F300-\U0001FAFF\U00002700-\U000027BF]+)\s*$")
_HEADLINE_FONT = "Montserrat"
_HEADLINE_FONT_FIT_TOP = "Anton"
_EMOJI_FONT = "Noto Color Emoji"
_MAX_LINES = 4
_HEADLINE_CHAR_LIMIT = 72


def _font_dirs() -> list[Path]:
    dirs: list[Path] = []
    for p in (
        "/usr/share/fonts/truetype/montserrat",
        "/usr/share/fonts/truetype/anton",
        "/app/v3/fonts",
        "/usr/share/fonts/truetype/noto",
        "/usr/share/fonts/noto",
    ):
        if Path(p).is_dir():
            dirs.append(Path(p))
    return dirs


def _esc_ass(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")


def _ass_color(hex_color: str) -> str:
    c = (hex_color or "").strip().lstrip("#")
    if len(c) >= 6:
        r, g, b = c[0:2], c[2:4], c[4:6]
        return f"&H00{b}{g}{r}".upper()
    return "&H00000000"


def _split_emoji_runs(text: str) -> str:
    out: list[str] = []
    for ch in text:
        o = ord(ch)
        if o > 0xFFFF or ("\U0001F300" <= ch <= "\U0001FAFF"):
            out.append(rf"{{\fn{_EMOJI_FONT}}}{ch}")
        else:
            out.append(ch)
    return "".join(out)


def _wrap_headline_lines(body: str, max_chars_per_line: int = 22) -> list[str]:
    """Parity with new-app wrapHeadlineDisplayLines (export-template.ts)."""
    words = body.split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        trial = " ".join(cur + [w]).strip()
        if len(trial) > max_chars_per_line and cur:
            lines.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
        if len(lines) >= _MAX_LINES:
            break
    if len(lines) >= _MAX_LINES and cur:
        lines[_MAX_LINES - 1] = f"{lines[_MAX_LINES - 1]} {' '.join(cur)}".strip()
    elif len(lines) < _MAX_LINES and cur:
        lines.append(" ".join(cur))
    return lines[:_MAX_LINES]


def format_headline_for_export(raw: str) -> str:
    """Parity with new-app formatHeadlineForExport."""
    trimmed = raw.strip()
    if not trimmed:
        return ""
    m = _EMOJI_RE.search(trimmed)
    emojis = (m.group(1) if m else "")[:2]
    body = trimmed[: m.start()].strip() if m else trimmed
    capped = body[:_HEADLINE_CHAR_LIMIT]
    upper = capped.upper()
    return f"{upper} {emojis}".strip() if emojis else upper


def prepare_headline_display(raw: str) -> str:
    trimmed = format_headline_for_export(raw)
    m = _EMOJI_RE.search(trimmed)
    emojis = (m.group(1) if m else "")[:2]
    core = trimmed[: m.start()].strip() if m else trimmed
    lines = _wrap_headline_lines(core)
    if emojis and lines:
        lines[-1] = f"{lines[-1]} {emojis}".strip()
    ass_lines = [_split_emoji_runs(_esc_ass(line.upper())) for line in lines if line.strip()]
    return r"\N".join(ass_lines)


def _headline_fonts_dir() -> Path | None:
    """Directory passed to ffmpeg ass= filter (emoji + Montserrat siblings)."""
    for candidate in (
        Path("/usr/share/fonts/truetype/montserrat"),
        Path("/usr/share/fonts/truetype/anton"),
        Path("/app/v3/fonts"),
        Path("/usr/share/fonts/truetype/noto"),
        Path("/usr/share/fonts/noto"),
    ):
        if candidate.is_dir():
            return candidate
    dirs = _font_dirs()
    return dirs[0] if dirs else None


def _headline_font_from_style(style: dict | None, *, fit_top: bool) -> str:
    raw = str((style or {}).get("font") or "").strip()
    if raw:
        low = raw.lower()
        if "anton" in low:
            return "Anton"
        if "montserrat" in low:
            return "Montserrat"
        if "poppins" in low:
            return "Poppins"
    if fit_top:
        for d in _font_dirs():
            if list(d.glob("*nton*.ttf")) or list(d.glob("*Anton*.ttf")):
                return "Anton"
        return _HEADLINE_FONT_FIT_TOP
    return _HEADLINE_FONT


def headline_ass_content(
    headline: str,
    *,
    play_w: int,
    play_h: int,
    bar_h: int,
    duration_ms: int,
    bar_y: int = 0,
    fit_top: bool = False,
    text_color: str | None = None,
    box_color: str | None = None,
    headline_style: dict | None = None,
    text_box_x: int | None = None,
    text_box_w: int | None = None,
) -> str:
    from clips_worker.overlay_geometry import headline_style_for_preset

    from clips_worker.headline_fit import fit_headline_display_for_box

    preset_style = headline_style_for_preset("stream_white_box" if fit_top else "export_bar")
    if headline_style and isinstance(headline_style, dict):
        preset_style = {**preset_style, **headline_style}
    primary = _ass_color(text_color or preset_style.get("textColor") or "#000000")
    raw_headline = format_headline_for_export(headline)
    width_pct = int(preset_style.get("widthPct") or 100)
    if text_box_w is not None and text_box_w > 0:
        box_w = max(1, int(text_box_w))
    else:
        box_w = max(1, int(play_w * (width_pct / 100.0) * 0.96))
    bold = fit_top or str(preset_style.get("preset") or "") == "bold_news"
    lines_fit, font_px = fit_headline_display_for_box(
        raw_headline, box_w, bar_h, bold_news=bold
    )
    if lines_fit:
        display = r"\N".join(
            _split_emoji_runs(_esc_ass(line.upper())) for line in lines_fit if line.strip()
        )
    else:
        display = prepare_headline_display(headline)
    font = _headline_font_from_style(headline_style, fit_top=fit_top)
    fontsize = max(font_px, 36 if fit_top else 28)
    y_center = bar_y + bar_h // 2
    cs = max(1, duration_ms) // 10
    h_part, rem = divmod(cs, 360000)
    m_part, rem = divmod(rem, 6000)
    s_part, c_part = divmod(rem, 100)
    end_ts = f"{h_part}:{m_part:02d}:{s_part:02d}.{c_part:02d}"

    if text_box_x is not None and text_box_w is not None and text_box_w > 0:
        text_center_x = text_box_x + text_box_w // 2
    else:
        text_center_x = play_w // 2

    fonts_lines = ""
    for d in _font_dirs():
        fonts_lines += f"FontsDir: {d}\n"

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_w}
PlayResY: {play_h}
WrapStyle: 2
ScaledBorderAndShadow: yes
{fonts_lines}
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Headline,{font},{fontsize},{primary},{primary},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,20,20,{max(8, bar_h // 12)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    tag = rf"{{\an5\pos({text_center_x},{y_center})}}"
    return header + f"Dialogue: 0,0:00:00.00,{end_ts},Headline,,0,0,0,,{tag}{display}\n"


def burn_stream_headline(
    video: Path,
    out: Path,
    headline: str,
    *,
    play_w: int,
    play_h: int,
    bar_h: int,
    duration_ms: int,
    bar_y: int = 0,
    fit_top: bool = False,
    text_color: str | None = None,
    box_color: str | None = None,
    headline_style: dict | None = None,
    scratch_dir: Path | None = None,
    text_box_x: int | None = None,
    text_box_w: int | None = None,
) -> Path:
    scratch = scratch_dir or video.parent
    ass = scratch / "stream_headline.ass"
    resolved_font = _headline_font_from_style(headline_style, fit_top=fit_top)
    ass.write_text(
        headline_ass_content(
            headline,
            play_w=play_w,
            play_h=play_h,
            bar_h=bar_h,
            duration_ms=duration_ms,
            bar_y=bar_y,
            fit_top=fit_top,
            text_color=text_color,
            box_color=box_color,
            headline_style=headline_style,
            text_box_x=text_box_x,
            text_box_w=text_box_w,
        ),
        encoding="utf-8",
    )
    fontsdir = _headline_fonts_dir()
    print(
        f"[editor:decision] headline_font font={resolved_font} fit_top={fit_top} "
        f"fontsdir={fontsdir or 'none'}",
        flush=True,
    )
    vf = f"ass={ass}"
    if fontsdir:
        vf = f"ass={ass}:fontsdir={fontsdir}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", vf, "-c:a", "copy", str(out)],
        check=True,
        capture_output=True,
        text=True,
    )
    return out
