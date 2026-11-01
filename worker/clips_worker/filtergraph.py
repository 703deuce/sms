"""ffmpeg filtergraph builders for multiperson crop v2 (unit-tested strings)."""
from __future__ import annotations

import os
import re

from clips_worker.compose_layout import layout_slots

OUT_W = 1080
OUT_H = 1920
DIVIDER_PX = 4
HALF_H = OUT_H // 2
QUAD_W = OUT_W // 2
QUAD_H = OUT_H // 2


def two_up_vstack_filter() -> str:
    return "[s0][s1]vstack=inputs=2"


def grid4_xstack_filter() -> str:
    return "[s0][s1][s2][s3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0"


def grid3_layout_filter() -> str:
    """One speaker full-width top (1080x960); two speakers hstack bottom (540x960 each)."""
    return f"[s0]scale={OUT_W}:{HALF_H}:flags=lanczos[t0];[s1][s2]hstack=inputs=2[bot];[t0][bot]vstack=inputs=2"


def grid3_layout_filter_labels(l0: str, l1: str, l2: str, out: str) -> str:
    return (
        f"[{l0}]scale={OUT_W}:{HALF_H}:flags=lanczos[{out}_t0];"
        f"[{l1}][{l2}]hstack=inputs=2[{out}_bot];"
        f"[{out}_t0][{out}_bot]vstack=inputs=2[{out}]"
    )


# E6: background blur strength for fit/blur fills. Gaussian sigma as a fraction of the OUTPUT width so the
# look is resolution-independent and the editor preview (lib/clips/fit-blur.ts) uses the same table.
# "soft" is the pre-E6 export look (boxblur=30:3 at full res ~= sigma 0.028·W); "strong" is the default.
FIT_BLUR_STRENGTHS = ("soft", "strong", "max")
DEFAULT_FIT_BLUR_STRENGTH = "strong"
FIT_BLUR_SIGMA_FRAC = {"soft": 0.028, "strong": 0.075, "max": 0.13}
FIT_BLUR_BRIGHTNESS = {"soft": -0.06, "strong": -0.08, "max": -0.1}


def fit_blur_strength(src: object = None) -> str:
    """Resolve strength from edits ({layout:{blurStrength}}), settings ({fitBlurStrength}), a str, or env."""
    val: object = None
    if isinstance(src, str):
        val = src
    elif isinstance(src, dict):
        val = src.get("fitBlurStrength")
        cb = src.get("canvasBg")
        if isinstance(cb, dict) and cb.get("type") == "blur" and cb.get("blur") in FIT_BLUR_STRENGTHS:
            val = cb.get("blur")
        lay = src.get("layout")
        if val is None and isinstance(lay, dict):
            val = lay.get("blurStrength")
    if val is None:
        val = os.environ.get("FIT_BLUR_STRENGTH")
    s = str(val or "").strip().lower()
    return s if s in FIT_BLUR_STRENGTHS else DEFAULT_FIT_BLUR_STRENGTH


def fit_blur_bg_chain(width: int, height: int, strength: str | None = None) -> str:
    """Filter chain (no labels) that turns one input into the blurred cover background."""
    st = fit_blur_strength(strength)
    if st == "soft":
        return (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
            f"boxblur=30:3,eq=brightness=-0.06:saturation=0.9"
        )
    # Blur at 1/4 size (cheap even for big sigma), then scale back up — the upscale only softens further.
    bw, bh = max(2, (width // 4) // 2 * 2), max(2, (height // 4) // 2 * 2)
    sigma = max(1.0, round(FIT_BLUR_SIGMA_FRAC[st] * width / 4, 2))
    return (
        f"scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},"
        f"gblur=sigma={sigma}:steps=3,scale={width}:{height}:flags=bicubic,"
        f"eq=brightness={FIT_BLUR_BRIGHTNESS[st]}:saturation=0.85"
    )


def fit_blur_overlay_filter(
    in_label: str, out_label: str, width: int, height: int, strength: str | None = None, *, bg: dict | None = None
) -> str:
    """Blurred background fill (no black bars). ``strength`` soft|strong|max (default strong / env)."""
    flat = canvas_bg_flat(bg)
    if flat and bg and bg.get("type") == "color":
        hexv = bg.get("color") or "000000"
        return (
            f"[{in_label}]scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0x{hexv},setsar=1[{out_label}]"
        )
    if flat and bg and bg.get("type") == "image" and bg.get("path"):
        return _canvas_bg_image_overlay_filter(in_label, out_label, width, height, str(bg["path"]), tag="fit")
    return (
        f"[{in_label}]split=2[a][b];"
        f"[a]{fit_blur_bg_chain(width, height, strength)}[bg];"
        f"[b]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2[{out_label}]"
    )


CANVAS_BG_TYPES = ("none", "color", "blur", "image")
_HEX_RE = re.compile(r"^#?([0-9a-fA-F]{6})$")
_SAFE_PATH_RE = re.compile(r"^[A-Za-z0-9_./-]+$")


def _ffmpeg_hex(raw: str) -> str:
    m = _HEX_RE.match(str(raw or "").strip())
    return m.group(1).upper() if m else "000000"


def _escape_movie_path(path: str) -> str:
    return path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def _canvas_bg_image_overlay_filter(
    in_label: str, out_label: str, width: int, height: int, path: str, *, tag: str = "cbg"
) -> str:
    p = _escape_movie_path(path)
    return (
        f"[{in_label}]split=2[{tag}a][{tag}b];"
        f"[{tag}a]scale={width}:{height},setsar=1[{tag}gc];"
        f"movie='{p}',scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},setsar=1,format=yuv420p[{tag}gi];"
        f"[{tag}gc][{tag}gi]overlay=0:0:eof_action=repeat[{tag}bg];"
        f"[{tag}b]scale={width}:{height}:force_original_aspect_ratio=decrease[{tag}fg];"
        f"[{tag}bg][{tag}fg]overlay=(W-w)/2:(H-h)/2[{out_label}]"
    )


def canvas_bg(src: object = None) -> dict | None:
    """CV-09. None = legacy. Else {type, color?, path?}."""
    raw: dict | None = None
    path: str | None = None
    if isinstance(src, dict):
        if isinstance(src.get("canvasBg"), dict):
            raw = src["canvasBg"]
        elif src.get("type") in CANVAS_BG_TYPES:
            raw = src
        path = src.get("_canvasBgPath") if isinstance(src.get("_canvasBgPath"), str) else None
        settings_bg = src.get("canvasBg")
        if isinstance(settings_bg, dict) and settings_bg.get("path"):
            path = str(settings_bg["path"])
    if not raw:
        t = os.environ.get("CANVAS_BG_TYPE", "").strip().lower()
        if t in ("color", "image", "none"):
            raw = {"type": t}
            if t == "color":
                raw["color"] = os.environ.get("CANVAS_BG_COLOR", "#000000")
            if t == "image":
                path = os.environ.get("CANVAS_BG_IMAGE") or path
        else:
            return None
    typ = str(raw.get("type") or "").strip().lower()
    if typ == "none":
        return {"type": "color", "color": "000000"}
    if typ == "color":
        return {"type": "color", "color": _ffmpeg_hex(str(raw.get("color") or "#000000"))}
    if typ == "blur":
        return {"type": "blur"}
    if typ == "image":
        if path and _SAFE_PATH_RE.match(path):
            return {"type": "image", "path": path}
        return {"type": "color", "color": "000000"}
    return None


def canvas_bg_flat(bg: dict | None) -> bool:
    return bool(bg and bg.get("type") in ("color", "image"))


def canvas_bg_env(bg: dict | None) -> dict[str, str]:
    if not bg or bg.get("type") == "blur":
        return {}
    if bg.get("type") == "color":
        return {"CANVAS_BG_TYPE": "color", "CANVAS_BG_COLOR": f"#{bg.get('color', '000000')}"}
    if bg.get("type") == "image" and bg.get("path"):
        return {"CANVAS_BG_TYPE": "image", "CANVAS_BG_IMAGE": str(bg["path"])}
    return {"CANVAS_BG_TYPE": "color", "CANVAS_BG_COLOR": "#000000"}


def canvas_bg_color_source(width: int, height: int, dur_s: float, bg: dict) -> str:
    hexv = bg.get("color") or "000000"
    return f"color=c=0x{hexv}:s={width}x{height}:d={dur_s}"


def canvas_bg_from_input(
    in_label: str,
    out_label: str,
    width: int,
    height: int,
    bg: dict | None,
    strength: str | None = None,
    tag: str = "cbg",
) -> str:
    """Graph segment in_label → out_label WxH background."""
    if not canvas_bg_flat(bg):
        return f"[{in_label}]{fit_blur_bg_chain(width, height, strength)}[{out_label}]"
    if bg and bg.get("type") == "color":
        hexv = bg.get("color") or "000000"
        return f"color=c=0x{hexv}:s={width}x{height}[{out_label}]"
    if bg and bg.get("type") == "image" and bg.get("path"):
        p = _escape_movie_path(str(bg["path"]))
        return (
            f"[{in_label}]scale={width}:{height},setsar=1[{tag}gc];"
            f"movie='{p}',scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},setsar=1,format=yuv420p[{tag}gi];"
            f"[{tag}gc][{tag}gi]overlay=0:0:eof_action=repeat[{out_label}]"
        )
    return f"color=c=black:s={width}x{height}[{out_label}]"


def canvas_bg_changes_frames(edits: dict) -> bool:
    bg = canvas_bg(edits)
    if bg is None:
        st = fit_blur_strength(edits)
        return st != DEFAULT_FIT_BLUR_STRENGTH
    if bg.get("type") == "blur":
        return fit_blur_strength(edits) != DEFAULT_FIT_BLUR_STRENGTH
    return True


def slot_crop_filter(
    in_label: str,
    out_label: str,
    cx: float,
    cy: float,
    src_w: int,
    src_h: int,
    slot_w: int,
    slot_h: int,
    scale: float = 1.0,
    *,
    letterbox_blur: bool = True,
) -> str:
    crop_w = int(min(src_w, slot_w / max(scale, 0.01)))
    crop_h = int(min(src_h, slot_h / max(scale, 0.01)))
    x = int(max(0, min(src_w - crop_w, cx - crop_w / 2)))
    y = int(max(0, min(src_h - crop_h, cy - crop_h / 2)))
    cropped = f"[{in_label}]crop={crop_w}:{crop_h}:{x}:{y}[{out_label}_raw]"
    if letterbox_blur:
        return (
            f"{cropped};"
            f"{fit_blur_overlay_filter(f'{out_label}_raw', out_label, slot_w, slot_h)}"
        )
    return f"{cropped};[{out_label}_raw]scale={slot_w}:{slot_h}:flags=lanczos[{out_label}]"


def side_by_side_filter() -> str:
    return "[s0][s1]hstack=inputs=2"


def screen_pip_overlay_filter(bg_label: str, cam_label: str, out_label: str, out_w: int, out_h: int) -> str:
    """Blur-fit main + webcam inset (IMPLEMENTATION-GUIDE §10.2 pip geometry)."""
    slots = layout_slots("screen_pip", out_w, out_h, 2)
    ox, oy, ow, oh = slots[1]
    return (
        f"[{cam_label}]scale={ow}:{oh}:flags=lanczos[cam];"
        f"[{bg_label}][cam]overlay={ox}:{oy}:format=auto[{out_label}]"
    )


def segment_layout_stack(layout: str) -> str:
    if layout == "two_up":
        return two_up_vstack_filter()
    if layout == "grid4":
        return grid4_xstack_filter()
    if layout == "grid3":
        return grid3_layout_filter()
    if layout == "side":
        return side_by_side_filter()
    return ""


def caption_seam_y(layout: str) -> int:
    if layout in ("two_up", "grid3", "grid4"):
        return HALF_H
    return OUT_H - 120
