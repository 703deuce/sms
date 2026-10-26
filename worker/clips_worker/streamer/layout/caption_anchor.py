"""Caption anchor for stacked streamer layouts (S9)."""
from __future__ import annotations


def caption_margin_v(position: str, *, stack_split: float = 0.4, frame_h: int = 1920) -> tuple[int, int]:
    """Return (alignment, MarginV) for ASS subtitles on 1080x1920 output."""
    pos = (position or "seam").lower()
    hf = int(round(frame_h * stack_split / 2)) * 2
    if pos == "top":
        return 8, 48
    if pos == "gameplay_bottom":
        return 2, max(80, frame_h - hf + 40)
    # seam — between facecam and gameplay panels
    seam_y = hf
    return 2, max(60, frame_h - seam_y + 24)
