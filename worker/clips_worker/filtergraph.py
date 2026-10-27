"""ffmpeg filtergraph builders for multiperson crop v2 (unit-tested strings)."""
from __future__ import annotations

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


def grid3_compose_filter() -> str:
    """Top full width + bottom hstack; expressed as chained filters in segment builder."""
    return "grid3"


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
) -> str:
    crop_w = int(min(src_w, slot_w / max(scale, 0.01)))
    crop_h = int(min(src_h, slot_h / max(scale, 0.01)))
    x = int(max(0, min(src_w - crop_w, cx - crop_w / 2)))
    y = int(max(0, min(src_h - crop_h, cy - crop_h / 2)))
    return (
        f"[{in_label}]crop={crop_w}:{crop_h}:{x}:{y},"
        f"scale={slot_w}:{slot_h}:flags=lanczos[{out_label}]"
    )


def segment_layout_stack(layout: str) -> str:
    if layout == "two_up":
        return two_up_vstack_filter()
    if layout == "grid4":
        return grid4_xstack_filter()
    if layout == "grid3":
        return (
            f"[top]scale={OUT_W}:{HALF_H}[t0];"
            f"[b0][b1]hstack=inputs=2[bot];"
            f"[t0][bot]vstack=inputs=2"
        )
    return ""


def caption_seam_y(layout: str) -> int:
    if layout in ("two_up", "grid3", "grid4"):
        return HALF_H
    return OUT_H - 120
