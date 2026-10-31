"""Burn optional hook title text in the first seconds of a clip (brand colours)."""
from __future__ import annotations

from pathlib import Path

import math

from clips_worker.motion import MOTION_FPS, has_motion, layer_transform_at
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
    motion_edits: dict | None = None,
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
    end_ts = _ass_ts(max(0, duration_ms) // 10)
    esc = text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")
    if motion_edits is not None and has_motion(motion_edits, "text"):
        return header + "".join(hook_motion_events(esc, duration_ms, motion_edits, w=w, h=h, y=y))
    tag = rf"{{\an8\pos({w // 2},{y})\fad(180,220)}}"
    line = f"Dialogue: 3,0:00:00.00,{end_ts},Hook,,0,0,0,,{tag}{esc}"
    return header + line + "\n"


def _ass_ts(cs: int) -> str:
    h_part, rem = divmod(cs, 360000)
    m_part, rem = divmod(rem, 6000)
    s_part, c_part = divmod(rem, 100)
    return f"{h_part}:{m_part:02d}:{s_part:02d}.{c_part:02d}"


HOOK_FADE_IN_MS = 180
HOOK_FADE_OUT_MS = 220


def hook_fade_at(t_ms: float, duration_ms: int) -> float:
    """ASS \\fad(180,220) as a 0..1 multiplier (mirrored by the editor's hook preview)."""
    if t_ms < HOOK_FADE_IN_MS:
        return max(0.0, t_ms / HOOK_FADE_IN_MS)
    if t_ms > duration_ms - HOOK_FADE_OUT_MS:
        return max(0.0, (duration_ms - t_ms) / HOOK_FADE_OUT_MS)
    return 1.0


def hook_motion_events(esc: str, duration_ms: int, edits: dict, *, w: int, h: int, y: int, fps: int = MOTION_FPS) -> list[str]:
    """
    E3 Text keyframes: one event per output frame with the interpolated transform. Origin is the
    \\an8 anchor (top centre of the text), like the preview's transform-origin. CSS rotate is
    clockwise, ASS \\frz counter-clockwise → \\frz(−R). The fade is folded into the alpha.
    """
    out: list[str] = []
    frames = int(math.ceil(duration_ms * fps / 1000))
    for f in range(frames):
        t_ms = f * 1000 / fps
        # Frame f (pts f/fps) must fall inside [start, end) — floor keeps every frame in its own event.
        start_cs = int(math.floor(f * 100 / fps + 1e-9))
        end_cs = min(int(math.floor((f + 1) * 100 / fps + 1e-9)), max(0, duration_ms) // 10)
        if end_cs <= start_cs:
            continue
        tf = layer_transform_at(edits, "text", t_ms)  # sampled at the frame's pts, like the preview
        op = max(0.0, min(1.0, tf["opacity"] / 100 * hook_fade_at(t_ms, duration_ms)))
        a = f"{round(255 * (1 - op)):02X}"
        shadow = f"{round(255 - (255 - 0x96) * op):02X}"  # style BackColour alpha &H96
        px = round(w // 2 + tf["x"] * w / 100)
        py = round(y + tf["y"] * h / 100)
        sc = round(tf["scale"], 2)
        rot = round(-tf["rotation"], 2)
        tag = (rf"{{\an8\pos({px},{py})\fscx{sc}\fscy{sc}\frz{rot}"
               rf"\1a&H{a}&\3a&H{a}&\4a&H{shadow}&}}")
        out.append(f"Dialogue: 3,{_ass_ts(start_cs)},{_ass_ts(end_cs)},Hook,,0,0,0,,{tag}{esc}\n")
    return out


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
        _hook_ass(text, duration_ms, w=play_w, h=play_h, primary_color=primary, motion_edits=edits),
        encoding="utf-8",
    )
    burn_ass(video, ass_path, out)
    return out
