"""T6 title style auto-pick (P4)."""
from __future__ import annotations

from clips_worker.t6_registry import TITLE_STYLES


def pick_title_style(spec: dict, signals: dict, history: list[str]) -> tuple[str, str]:
    _ = history
    bands = signals.get("bands") if isinstance(signals.get("bands"), dict) else {}
    top = bands.get("top") if isinstance(bands.get("top"), dict) else {}
    luma = float(top.get("luma") or 0.3)
    busy = float(top.get("busy") or 0.5)
    if isinstance(spec, dict) and spec.get("bands"):
        if luma > 0.6:
            return "black_on_light_blur", "bright_band"
        if busy > 0.55:
            return "white_box_black", "busy_blur"
        return "white_on_dark_blur", "blur_band"
    if luma > 0.6:
        return "black_on_light_blur", "bright"
    return "white_on_black", "dark"


def title_style(style_id: str) -> dict:
    return dict(TITLE_STYLES.get(style_id) or TITLE_STYLES["white_on_black"])
