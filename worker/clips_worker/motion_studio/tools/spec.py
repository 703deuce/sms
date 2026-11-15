"""Versioned structured scene specification (planning document, not live render state)."""
from __future__ import annotations

from typing import Any

from clips_worker.motion_studio.core.api_manifest import ENGINE_SHA, load_manifest

SPEC_VERSION = "1.0"
SPEC_SCHEMA = "motion.studio.scene_spec"

# Limits for a single scene specification (resource envelope).
MAX_ENVIRONMENTS = 16
MAX_OBJECTS = 200
MAX_CAMERA_MOVES = 80
MAX_MEDIA = 80
MAX_PRIMITIVES = 400
MAX_AUDIO_EVENTS = 80
MAX_TRANSITIONS = 16


def new_spec(
    scene_id: str,
    *,
    fps: int = 30,
    duration_frames: int | None = None,
    duration_s: float | None = None,
    catalog_ids: list[str] | None = None,
    engine: str = "cinematic_skill",
) -> dict[str, Any]:
    """Empty versioned spec the agent fills via registered tool calls."""
    try:
        sha = load_manifest().get("engineSha") or ENGINE_SHA
    except Exception:  # noqa: BLE001
        sha = ENGINE_SHA
    dur_frames = duration_frames
    if dur_frames is None and duration_s is not None:
        dur_frames = int(round(float(duration_s) * fps))
    return {
        "schema": SPEC_SCHEMA,
        "version": SPEC_VERSION,
        "engine": engine,
        "engineSha": sha,
        "sceneId": scene_id,
        "fps": int(fps),
        "durationFrames": dur_frames,
        "environments": {},
        "objects": {},
        "assets": {i: {"id": i} for i in (catalog_ids or [])},
        "typography": {},
        "animation": {},
        "camera": {},
        "sound": {},
        "timing": {"words": {}, "anchors": {}},
        "transitions": {},
        "extensions": {},
        "ops": [],
    }


def next_id(spec: dict, prefix: str) -> str:
    existing = []
    for bag in ("environments", "objects", "typography", "animation", "camera", "sound", "transitions", "extensions"):
        existing.extend((spec.get(bag) or {}).keys())
    n = 1
    while f"{prefix}_{n}" in existing:
        n += 1
    return f"{prefix}_{n}"


def frames_to_s(spec: dict, frame: int | float) -> float:
    fps = float(spec.get("fps") or 30) or 30.0
    return float(frame) / fps


def duration_s(spec: dict) -> float | None:
    frames = spec.get("durationFrames")
    if frames is None:
        return None
    return frames_to_s(spec, frames)
