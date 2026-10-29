"""PNG sprites for v3 badge/sticker layers (export compositor)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.clip_export_template import _esc_drawtext, _platform_label
from clips_worker.overlay_geometry import badge_rect, sticker_rect

_ASSETS = Path(__file__).resolve().parent.parent / "assets" / "brand"


def _brand_logo_path(platform: str) -> Path | None:
    p = (platform or "twitch").lower()
    if p == "kick":
        candidate = _ASSETS / "kick_black_128.png"
    else:
        candidate = _ASSETS / "twitch_white_128.png"
    return candidate if candidate.is_file() else None


def render_badge_png(
    layer: dict,
    dest: Path,
    *,
    play_w: int,
    play_h: int,
    placement: str = "export_bar",
    video_y: int = 0,
    video_h: int = 0,
    badge_y: int | None = None,
) -> Path:
    rect = badge_rect(
        placement,
        play_w,
        play_h,
        video_y=video_y,
        video_h=video_h,
        badge_y=badge_y,
    )
    w, h = max(8, rect["w"]), max(8, rect["h"])
    platform = str(layer.get("platform") or "twitch")
    label, color = _platform_label(platform)
    show_label = bool(layer.get("showLabel"))
    handle = str(layer.get("handle") or layer.get("url") or "").split("/")[-1][:24]
    text = handle.upper() if handle else label
    if not show_label and not layer.get("showLogo"):
        text = label

    logo = _brand_logo_path(platform) if layer.get("showLogo") else None
    if logo:
        filter_parts = [
            f"color=c={color}:s={w}x{h}:d=1,format=rgba[bg]",
            f"movie={logo}:scale={min(w - 8, 28)}:-1[lg]",
            "[bg][lg]overlay=4:4[bg2]",
        ]
        if show_label and text:
            filter_parts.append(
                f"[bg2]drawtext=text='{_esc_drawtext(text)}':fontsize={max(12, h // 3)}:"
                f"fontcolor=white:x={min(w // 3, 36)}:y={(h - max(12, h // 3)) // 2}[v]"
            )
        else:
            filter_parts.append("[bg2]null[v]")
        fc = ";".join(filter_parts)
    else:
        fc = (
            f"color=c={color}:s={w}x{h}:d=1,"
            f"drawtext=text='{_esc_drawtext(text[:24])}':fontsize={max(12, h // 3)}:"
            f"fontcolor=white:x={(w - len(text) * 6) // 2}:y={(h - max(12, h // 3)) // 2}[v]"
        )

    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-filter_complex",
            fc,
            "-map",
            "[v]",
            "-frames:v",
            "1",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return dest


def render_sticker_png(
    layer: dict,
    dest: Path,
    *,
    play_w: int,
    play_h: int,
) -> Path:
    text = str(layer.get("text") or "FOLLOW").strip()[:32] or "FOLLOW"
    platform = str(layer.get("platform") or "twitch")
    _, color = _platform_label(platform)
    x_pct = float(layer.get("x") if layer.get("x") is not None else 0.82)
    y_pct = float(layer.get("y") if layer.get("y") is not None else 0.12)
    anchor = str(layer.get("anchor") or "center")
    rect = sticker_rect(play_w, play_h, x_pct, y_pct, anchor=anchor)
    w, h = rect["w"], rect["h"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-filter_complex",
            (
                f"color=c={color}:s={w}x{h}:d=1,"
                f"drawtext=text='{_esc_drawtext(text)}':fontsize={max(14, h // 3)}:"
                f"fontcolor=white:x={(w - len(text) * 7) // 2}:y={(h - max(14, h // 3)) // 2}[v]"
            ),
            "-map",
            "[v]",
            "-frames:v",
            "1",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return dest
