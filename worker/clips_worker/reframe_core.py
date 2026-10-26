"""Pure face/crop helpers for local + Modal parity (S15). No DB or storage imports."""
from __future__ import annotations


def blend_targets(prev: float, nxt: float, alpha: float = 0.35) -> float:
    return prev * (1 - alpha) + nxt * alpha


def track_faces(_video_path: str, params: dict | None = None) -> dict:
    """Placeholder crop track; Modal S15 replaces with YuNet pipeline."""
    params = params or {}
    fps = float(params.get("fps") or 30)
    duration_s = float(params.get("duration_s") or 10)
    frames = max(1, int(duration_s * fps))
    cx = float(params.get("center_x") or 0.5)
    track = [{"t": i / fps, "cx": cx, "cy": 0.35, "zoom": 1.0} for i in range(frames)]
    return {"v": 1, "fps": fps, "track": track}
