"""Build ASS for optional chat overlay (S9) — slide-up lines in lower blur band."""
from __future__ import annotations

from pathlib import Path


def _ass_color(hex_color: str) -> str:
    h = (hex_color or "#FFFFFF").lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF&"
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H00{b.upper()}{g.upper()}{r.upper()}&"


def _ts(ms: int) -> str:
    h = ms // 3_600_000
    m = (ms % 3_600_000) // 60_000
    s = (ms % 60_000) // 1000
    cs = (ms % 1000) // 10
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def build_chat_ass(
    lines: list[dict],
    *,
    width: int = 1080,
    play_h: int = 1920,
    chat_top: int | None = None,
    chat_h: int | None = None,
    opacity: float = 0.72,
    max_visible: int = 6,
) -> str:
    """One dialogue event per message; \\move slide-up into a lower-band slot."""
    band_top = int(chat_top if chat_top is not None else int(play_h * 0.68))
    band_h = int(chat_h if chat_h is not None else play_h - band_top)
    slot_h = max(34, min(48, band_h // max(4, max_visible)))
    alpha = hex(255 - int(max(0.0, min(1.0, opacity)) * 255))[2:].zfill(2)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {play_h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ChatUser,Arial,28,&H00FFFFFF,&H000000FF,&H00000000,&H{alpha}000000,1,0,0,0,100,100,0,0,3,1,0,7,32,32,48,1
Style: ChatBody,Arial,26,&H00FFFFFF,&H000000FF,&H00000000,&H{alpha}000000,0,0,0,0,100,100,0,0,3,1,0,7,32,32,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    visible = 0
    thinned = len(lines) > max_visible * 8
    step = 2 if thinned else 1
    for line in lines[::step][: max_visible * 12]:
        start_ms = max(0, int(line.get("tMs") or 0))
        end_ms = start_ms + 5500
        user = _esc(str(line.get("user") or "?")[:28])
        text = _esc(str(line.get("text") or "")[:120])
        if not text:
            continue
        user_color = _ass_color(str(line.get("color") or "#FFFFFF"))
        slot = visible % max_visible
        y_end = band_top + band_h - 24 - slot * slot_h
        y_start = y_end + 28
        x = width - 36
        events.append(
            f"Dialogue: 0,{_ts(start_ms)},{_ts(end_ms)},ChatUser,,0,0,0,,"
            f"{{\\move({x},{y_start},{x},{y_end},0,280)\\1c{user_color}}}{user}:"
        )
        events.append(
            f"Dialogue: 0,{_ts(start_ms)},{_ts(end_ms)},ChatBody,,0,0,0,,"
            f"{{\\move({x - 8},{y_start + 22},{x - 8},{y_end + 22},0,280)}}{text}"
        )
        visible += 1
    return header + "\n".join(events) + "\n"


def burn_chat_ass(video: Path, out: Path, ass_path: Path) -> None:
    import subprocess

    vf = f"ass={ass_path}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", vf, "-c:a", "copy", str(out)],
        check=True,
        capture_output=True,
        text=True,
    )
