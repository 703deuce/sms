"""Layout slot geometry — aligned with docs/clips/clipper/IMPLEMENTATION-GUIDE.md §10.2."""
from __future__ import annotations


def layout_slots(layout: str, out_w: int, out_h: int, n: int = 1) -> list[tuple[int, int, int, int]]:
    """Output rectangles (x, y, w, h) for each slot."""
    layout = (layout or "single").strip()
    if layout == "split":
        h = out_h // 2
        return [(0, 0, out_w, h), (0, h, out_w, out_h - h)]
    if layout == "three":
        h = out_h // 3
        return [(0, i * h, out_w, h if i < 2 else out_h - 2 * h) for i in range(3)]
    if layout in ("grid", "grid4"):
        w, h = out_w // 2, out_h // 2
        slots = [
            (0, 0, w, h),
            (w, 0, out_w - w, h),
            (0, h, w, out_h - h),
            (w, h, out_w - w, out_h - h),
        ]
        return slots[: max(n, 1)]
    if layout == "side":
        w = out_w // 2
        return [(0, 0, w, out_h), (w, 0, out_w - w, out_h)]
    if layout in ("pip", "screen_pip"):
        bw = out_w // 3 // 2 * 2
        bh = int(bw * 4 / 3) // 2 * 2
        m = out_w // 24 // 2 * 2
        return [(0, 0, out_w, out_h), (out_w - bw - m, out_h - bh - int(out_h * 0.22), bw, bh)]
    return [(0, 0, out_w, out_h)]
