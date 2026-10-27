"""Burn optional hook title text in the first seconds of a clip (brand colours)."""
from __future__ import annotations

from pathlib import Path

from clips_worker.t2v.titles_ass import burn_ass


def _hex_to_ass(hex_rgb: str, alpha: str = "00") -> str:
    h = hex_rgb.strip().lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H{alpha}{b:02X}{g:02X}{r:02X}"


def _hook_ass(
    text: str,
    duration_ms: int,
    *,
    w: int,
    h: int,
    primary_color: str,
    font: str = "DejaVu Sans",
) -> str:
    primary = _hex_to_ass(primary_color)
    short = min(w, h)
    fontsize = round(short * 0.072)
    margin_lr = round(w * 0.08)
    y = round(h * 0.11)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,{font},{fontsize},{primary},&H00FFFFFF,&H00000000,&H96000000,1,0,0,0,100,100,0,0,1,4,2,8,{margin_lr},{margin_lr},40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    cs = max(0, duration_ms) // 10
    h_part, rem = divmod(cs, 360000)
    m_part, rem = divmod(rem, 6000)
    s_part, c_part = divmod(rem, 100)
    end_ts = f"{h_part}:{m_part:02d}:{s_part:02d}.{c_part:02d}"
    esc = text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")
    tag = rf"{{\an8\pos({w // 2},{y})\fad(180,220)}}"
    line = f"Dialogue: 3,0:00:00.00,{end_ts},Hook,,0,0,0,,{tag}{esc}"
    return header + line + "\n"


def apply_hook_overlay(
    video: Path,
    out: Path,
    edits: dict,
    *,
    play_w: int,
    play_h: int,
) -> Path:
    ho = edits.get("hookOverlay") if isinstance(edits.get("hookOverlay"), dict) else None
    if not ho or not ho.get("enabled"):
        return video
    text = str(ho.get("text") or "").strip()
    if not text:
        return video
    duration_ms = int(ho.get("durationMs") or 2500)
    duration_ms = max(1500, min(5000, duration_ms))
    brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else {}
    primary = str(brand.get("primaryColor") or "#FACC15")
    ass_path = out.parent / "hook.ass"
    ass_path.write_text(
        _hook_ass(text, duration_ms, w=play_w, h=play_h, primary_color=primary),
        encoding="utf-8",
    )
    burn_ass(video, ass_path, out)
    return out
