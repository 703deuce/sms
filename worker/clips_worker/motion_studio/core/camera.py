"""Engine camera HOW. Scene authors may omit keys; the engine supplies a still hold."""

from __future__ import annotations

DEFAULT_HOLD_X = 0.0
DEFAULT_HOLD_Y = 0.0
DEFAULT_HOLD_ZOOM = 0.4


def ensure_camera_hold(
    film,
    duration,
    *,
    x: float = DEFAULT_HOLD_X,
    y: float = DEFAULT_HOLD_Y,
    zoom: float = DEFAULT_HOLD_ZOOM,
) -> bool:
    """If the film has no camera keys, add a still hold at (x, y, zoom) for the scene duration.

    Returns True when a hold was added. Camera timing is engine HOW: typography-only or custom
    build_scene code that never called film.cam / film.shot must still render, not crash.
    This is not a framework scene substitution — the authored items stay as they are.
    """
    keys = getattr(film, "cam_keys", None)
    if keys:
        return False
    dur = max(float(duration if duration is not None else getattr(film, "duration", 0.0) or 0.0), 0.0)
    film.cam(0.0, float(x), float(y), float(zoom))
    if dur > 0:
        film.cam(dur, float(x), float(y), float(zoom))
    return True
