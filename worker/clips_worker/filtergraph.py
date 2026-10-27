"""ffmpeg filtergraph builders for multiperson crop v2 (unit-tested strings)."""
from __future__ import annotations

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


def fit_blur_overlay_filter(in_label: str, out_label: str, width: int, height: int) -> str:
    """Blurred background fill (no black bars)."""
    return (
        f"[{in_label}]split=2[a][b];"
        f"[a]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
        f"boxblur=20:2,eq=brightness=0.8:saturation=0.92[bg];"
        f"[b]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2[{out_label}]"
    )


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
