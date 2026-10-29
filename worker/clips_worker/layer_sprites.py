"""PNG sprites for v3 badge/sticker layers (export compositor)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.clip_export_template import _esc_drawtext, _platform_label
from clips_worker.overlay_geometry import GEOM, badge_rect, sticker_rect

_ASSETS = Path(__file__).resolve().parent.parent / "assets" / "brand"
_MONTSERRAT = Path("/usr/share/fonts/truetype/montserrat/Montserrat-Black.ttf")
_V3_MONTSERRAT = Path(__file__).resolve().parent.parent / "v3" / "fonts" / "Montserrat-Black.ttf"
_V3_ANTON = Path(__file__).resolve().parent.parent / "v3" / "fonts" / "Anton-Regular.ttf"
_ANTON_SYS = Path("/usr/share/fonts/truetype/anton/Anton-Regular.ttf")

_DEJAVU_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def _badge_label_fontfile() -> str | None:
    for path in (_MONTSERRAT, _V3_MONTSERRAT, _V3_ANTON, _ANTON_SYS, _DEJAVU_BOLD):
        if path.is_file():
            return str(path).replace(":", "\\:")
    return None


def _brand_logo_path(platform: str) -> Path | None:
    p = (platform or "twitch").lower()
    if p == "kick":
        candidate = _ASSETS / "kick_black_128.png"
    else:
        candidate = _ASSETS / "twitch_white_128.png"
    return candidate if candidate.is_file() else None


def _badge_scale(play_h: int) -> float:
    base_h = int(GEOM.get("baseH") or 1920)
    return play_h / base_h


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
    platform = str(layer.get("platform") or "twitch")
    label, color = _platform_label(platform)
    show_label = bool(layer.get("showLabel"))
    show_logo = bool(layer.get("showLogo"))
    handle = str(layer.get("handle") or layer.get("url") or "").split("/")[-1][:24]
    text = handle.upper() if handle else label
    if not show_label and not show_logo:
        text = label

    rect = badge_rect(
        placement,
        play_w,
        play_h,
        text=text if show_label else "",
        show_logo=show_logo,
        video_y=video_y,
        video_h=video_h,
        badge_y=badge_y,
    )
    w, h = max(8, rect["w"]), max(8, rect["h"])
    badge = GEOM.get("badge") or {}
    s = _badge_scale(play_h)
    logo_size = max(8, int(round(float(badge.get("logoPx") or 40) * s)))
    font_size = max(10, int(round(float(badge.get("fontPx") or 32) * s)))
    pad_x = max(4, int(round(float(badge.get("padXPx") or 22) * s)))
    gap_x = max(2, int(round(float(badge.get("gapPx") or 12) * s)))
    fontfile = _badge_label_fontfile()
    font_opt = f"fontfile={fontfile}:" if fontfile else "font=DejaVu-Sans-Bold:"
    draw_text = text if show_label else ""

    logo = _brand_logo_path(platform) if show_logo else None
    if logo:
        logo_path = str(logo).replace("\\", "/").replace(":", "\\:")
        filter_parts = [
            f"color=c={color}:s={w}x{h}:d=1,format=rgba[bg]",
            f"movie={logo_path}[lg0];[lg0]scale={logo_size}:-1[lg]",
            f"[bg][lg]overlay={pad_x}:{max(0, (h - logo_size) // 2)}[bg2]",
        ]
        if show_label and draw_text:
            text_x = pad_x + logo_size + gap_x
            filter_parts.append(
                f"[bg2]drawtext=text='{_esc_drawtext(draw_text)}':{font_opt}"
                f"fontsize={font_size}:fontcolor=white:x={text_x}:y={(h - font_size) // 2}[v]"
            )
        else:
            filter_parts.append("[bg2]null[v]")
        fc = ";".join(filter_parts)
    else:
        text_x = (w - len(draw_text) * int(font_size * 0.62)) // 2 if draw_text else pad_x
        fc = (
            f"color=c={color}:s={w}x{h}:d=1,"
            f"drawtext=text='{_esc_drawtext(draw_text[:24])}':{font_opt}"
            f"fontsize={font_size}:fontcolor=white:x={max(pad_x, text_x)}:y={(h - font_size) // 2}[v]"
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


def _parse_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = (hex_color or "#FFFFFF").lstrip("#")
    if len(h) != 6:
        return (255, 255, 255, alpha)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def render_headline_box_png(w: int, h: int, color_hex: str, radius_px: int, dest: Path) -> Path:
    from PIL import Image, ImageDraw

    w, h = max(2, int(w)), max(2, int(h))
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    fill = _parse_rgba(color_hex)
    r = max(0, int(radius_px))
    if r > 0:
        draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=fill)
    else:
        draw.rectangle([0, 0, w - 1, h - 1], fill=fill)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    return dest


def headline_box_overlay_x(play_w: int, width_pct: int) -> int:
    w = round(play_w * float(width_pct) / 100.0)
    return max(0, (int(play_w) - w) // 2)


def headline_drawbox_filter(play_w: int, y: int, bar_h: int, box_fill: str, style: dict) -> str:
    width_pct = int(style.get("widthPct") or 100)
    radius_px = int(style.get("radiusPx") or 0)
    if radius_px <= 0 and width_pct >= 100:
        return f"drawbox=x=0:y={y}:w={play_w}:h={bar_h}:color={box_fill}@1:t=fill"
    x = headline_box_overlay_x(play_w, width_pct)
    return f"overlay=x={x}:y={y}"
