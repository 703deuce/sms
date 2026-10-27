"""Stream export headline bar (ASS) — Montserrat + Noto Color Emoji."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

_EMOJI_RE = re.compile(r"([\U0001F300-\U0001FAFF\U00002700-\U000027BF]+)\s*$")
_HEADLINE_FONT = "Montserrat"
_EMOJI_FONT = "Noto Color Emoji"
_MAX_LINES = 3
_HEADLINE_CHAR_LIMIT = 72


def _font_dirs() -> list[Path]:
    dirs: list[Path] = []
    for p in (
        "/usr/share/fonts/truetype/montserrat",
        "/app/v3/fonts",
        "/usr/share/fonts/truetype/noto",
        "/usr/share/fonts/noto",
    ):
        if Path(p).is_dir():
            dirs.append(Path(p))
    return dirs


def _esc_ass(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")


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
    if len(lines) < _MAX_LINES and cur:
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
        Path("/app/v3/fonts"),
        Path("/usr/share/fonts/truetype/noto"),
        Path("/usr/share/fonts/noto"),
    ):
        if candidate.is_dir():
            return candidate
    dirs = _font_dirs()
    return dirs[0] if dirs else None


def headline_ass_content(
    headline: str,
    *,
    play_w: int,
    play_h: int,
    bar_h: int,
    duration_ms: int,
) -> str:
    display = prepare_headline_display(headline)
    fontsize = max(28, min(50, int(bar_h * 0.20)))
    y_center = int(bar_h * 0.55)
    cs = max(1, duration_ms) // 10
    h_part, rem = divmod(cs, 360000)
    m_part, rem = divmod(rem, 6000)
    s_part, c_part = divmod(rem, 100)
    end_ts = f"{h_part}:{m_part:02d}:{s_part:02d}.{c_part:02d}"

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
Style: Headline,{_HEADLINE_FONT},{fontsize},&H00000000,&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,8,36,36,{max(8, bar_h // 10)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    tag = rf"{{\an8\pos({play_w // 2},{y_center})}}"
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
) -> Path:
    ass = video.parent / "stream_headline.ass"
    ass.write_text(
        headline_ass_content(headline, play_w=play_w, play_h=play_h, bar_h=bar_h, duration_ms=duration_ms),
        encoding="utf-8",
    )
    fontsdir = _headline_fonts_dir()
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
