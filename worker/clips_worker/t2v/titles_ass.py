"""Titles and lower thirds as ASS (burned via ffmpeg ass= filter).

Separate from captions so users can toggle captions without losing titles.
Brand kit supplies font family and primary colour (hex #RRGGBB).
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,{font},{title_size},{primary},&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,3,2,5,60,60,60,1
Style: Lower,{font},{lower_size},{primary},&H00FFFFFF,&H00000000,&HB4000000,1,0,0,0,100,100,0,0,3,12,0,1,60,60,{lower_mv},1
Style: Sub,{font},{sub_size},{muted},&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,0,0,3,10,0,1,60,60,{sub_mv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


@dataclass
class TextItem:
    kind: str
    text: str
    start_ms: int
    end_ms: int
    subtitle: str = ""
    animation: str = "fade"


def _ts(ms: int) -> str:
    cs = max(0, ms) // 10
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _esc(t: str) -> str:
    return t.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")


def hex_to_ass_color(hex_rgb: str, alpha: str = "00") -> str:
    h = hex_rgb.strip().lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H{alpha}{b:02X}{g:02X}{r:02X}"


def build_ass(
    items: list[TextItem],
    *,
    w: int,
    h: int,
    font: str = "DejaVu Sans",
    primary_color: str = "#FFFFFF",
    muted_color: str = "#D0D0D0",
) -> str:
    short = min(w, h)
    primary = hex_to_ass_color(primary_color)
    muted = hex_to_ass_color(muted_color)
    out = [
        HEADER.format(
            w=w, h=h, font=font,
            title_size=round(short * 0.085),
            lower_size=round(short * 0.045),
            sub_size=round(short * 0.032),
            lower_mv=round(h * 0.16),
            sub_mv=round(h * 0.11),
            primary=primary,
            muted=muted,
        )
    ]
    for it in items:
        start_ms = max(0, int(it.start_ms))
        end_ms = max(start_ms + 1, int(it.end_ms))
        fade = r"{\fad(250,250)}" if it.animation != "none" else ""
        if it.kind == "title":
            if it.animation == "slide_up":
                tag = rf"{{\an5\move({w // 2},{round(h * 0.58)},{w // 2},{h // 2},0,300)\fad(200,250)}}"
            else:
                tag = rf"{{\an5\pos({w // 2},{h // 2})}}" + fade
            out.append(f"Dialogue: 2,{_ts(start_ms)},{_ts(end_ms)},Title,,0,0,0,,{tag}{_esc(it.text)}")
        else:
            x = round(w * 0.06)
            name_y = round(h * (0.80 if it.subtitle else 0.86))
            out.append(
                f"Dialogue: 2,{_ts(start_ms)},{_ts(end_ms)},Lower,,0,0,0,,"
                f"{{\\an1\\pos({x},{name_y})}}{fade}{_esc(it.text)}"
            )
            if it.subtitle:
                out.append(
                    f"Dialogue: 2,{_ts(start_ms)},{_ts(end_ms)},Sub,,0,0,0,,"
                    f"{{\\an1\\pos({x},{round(h * 0.88)})}}{fade}{_esc(it.subtitle)}"
                )
    return "\n".join(out) + "\n"


def burn_ass(video: Path, ass_path: Path, out: Path) -> Path:
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(video),
            "-vf", f"ass={ass_path}",
            "-c:a", "copy",
            str(out),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return out
