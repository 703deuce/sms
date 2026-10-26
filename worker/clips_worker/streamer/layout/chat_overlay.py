"""Build ASS for optional chat overlay (S9)."""
from __future__ import annotations


def build_chat_ass(lines: list[dict], *, width: int = 1080, opacity: float = 0.6) -> str:
    alpha = hex(255 - int(max(0.0, min(1.0, opacity)) * 255))[2:].zfill(2)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Chat,Arial,34,&H00FFFFFF,&H000000FF,&H00000000,&H{alpha}000000,0,0,0,0,100,100,0,0,3,1,0,7,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    visible = 0
    for line in lines[:48]:
        start_ms = max(0, int(line.get("tMs") or 0))
        end_ms = start_ms + 6000
        text = str(line.get("text") or "").replace("\n", " ")
        user = str(line.get("user") or "")
        events.append(
            f"Dialogue: 0,{_ts(start_ms)},{_ts(end_ms)},Chat,,0,0,0,,{{\\pos(900,{180 + visible * 42})}}{user}: {text}"
        )
        visible = (visible + 1) % 6
    return header + "\n".join(events) + "\n"


def _ts(ms: int) -> str:
    h = ms // 3_600_000
    m = (ms % 3_600_000) // 60_000
    s = (ms % 60_000) // 1000
    cs = (ms % 1000) // 10
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
