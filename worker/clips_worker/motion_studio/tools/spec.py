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



def attach_scene_timing(spec: dict, *, duration_s: float | None = None, fps: int | None = None,
                        anchors: dict | None = None) -> dict:
    """Stamp the real scene duration and optional line/word anchors onto a spec."""
    if fps:
        spec["fps"] = int(fps)
    fps_i = int(spec.get("fps") or 30)
    if duration_s is not None and spec.get("durationFrames") is None:
        spec["durationFrames"] = int(round(float(duration_s) * fps_i))
    timing = spec.setdefault("timing", {"words": {}, "anchors": {}})
    if anchors:
        if anchors.get("lines"):
            timing["lines"] = anchors["lines"]
        if anchors.get("words"):
            timing["words"] = anchors["words"]
        if anchors.get("anchors"):
            timing["anchors"] = anchors["anchors"]
    return spec


def _anchor_seconds(spec: dict, line_id: str | None, word: str | None, at: str) -> float | None:
    timing = spec.get("timing") or {}
    if word:
        for w in (timing.get("words") or {}).values() if isinstance(timing.get("words"), dict) else (timing.get("words") or []):
            rec = w if isinstance(w, dict) else {}
            if str(rec.get("w") or rec.get("word") or rec.get("id") or "") != str(word):
                continue
            if line_id and str(rec.get("line") or rec.get("lineId") or "") not in ("", str(line_id)):
                continue
            key = "e" if str(at).lower() in {"end", "e", "out"} else "s"
            if rec.get(key) is not None:
                return float(rec[key])
            if rec.get("startS" if key == "s" else "endS") is not None:
                return float(rec.get("startS" if key == "s" else "endS"))
    if line_id:
        lines = timing.get("lines") or {}
        rec = lines.get(line_id) if isinstance(lines, dict) else None
        if rec is None and isinstance(lines, list):
            rec = next((r for r in lines if isinstance(r, dict) and r.get("id") == line_id), None)
        if isinstance(rec, dict):
            key = "endS" if str(at).lower() in {"end", "e", "out"} else "startS"
            alt = "end" if key == "endS" else "start"
            if rec.get(key) is not None:
                return float(rec[key])
            if rec.get(alt) is not None:
                return float(rec[alt])
    return None


def _token_is_end(value) -> bool:
    if value is None or value is False:
        return False
    if value is True:
        return True
    if isinstance(value, (int, float)) and float(value) < 0:
        return True
    return str(value).strip().lower() in {"end", "duration", "scene", "ctx.duration"}


def _to_frame(spec: dict, *, frame=None, seconds=None, frac=None, line_id=None, word=None, at="start"):
    """Convert one relative time to a frame. Returns (frame|None, error_message|None)."""
    fps = float(spec.get("fps") or 30) or 30.0
    dur_f = spec.get("durationFrames")
    if line_id or word:
        seconds = _anchor_seconds(spec, line_id, word, at)
        if seconds is None:
            return None, f"unknown timing anchor line={line_id!r} word={word!r}"
    if frac is not None:
        if _token_is_end(frac):
            frac = 1.0
        if dur_f is None:
            return None, "scene duration is required to resolve a fraction"
        try:
            f = float(frac)
        except (TypeError, ValueError):
            return None, "timing fraction must be a number between 0 and 1"
        f = max(0.0, min(1.0, f))
        return int(round(f * int(dur_f))), None
    if seconds is not None:
        if _token_is_end(seconds):
            if dur_f is None:
                return None, "scene duration is required to resolve an end time"
            return int(dur_f), None
        try:
            return int(round(float(seconds) * fps)), None
        except (TypeError, ValueError):
            return None, "timing seconds must be a number"
    if frame is not None:
        try:
            return int(frame), None
        except (TypeError, ValueError):
            return None, "frame must be an integer"
    return None, None


def clamp_frame(spec: dict, frame: int | None) -> int | None:
    """Keep a frame inside the real scene duration. Timing math belongs to the engine."""
    if frame is None:
        return None
    dur = spec.get("durationFrames")
    frame = int(frame)
    if frame < 0:
        frame = 0
    if dur is not None and frame > int(dur):
        frame = int(dur)
    return frame


def resolve_scene_timing(
    spec: dict,
    arguments: dict | None,
    *,
    default_start: int | str | None = None,
    default_end: int | str | None = None,
    required: bool = False,
) -> tuple[int | None, int | None, str | None]:
    """Resolve tool timing to frames from the real scene duration.

    Accepted (preferred first): startS/endS (seconds from scene start),
    startFrac/endFrac (0..1 of the scene), startLineId/endLineId or a
    startAnchor/endAnchor {lineId, word, at}, then startFrame/endFrame
    (legacy). Over-long or negative frames are clamped. A missing end
    with default_end='duration' uses the real last frame.
    """
    args = arguments or {}
    start_anchor = args.get("startAnchor") if isinstance(args.get("startAnchor"), dict) else {}
    end_anchor = args.get("endAnchor") if isinstance(args.get("endAnchor"), dict) else {}
    start, err = _to_frame(
        spec,
        frame=args.get("startFrame"),
        seconds=args.get("startS") if "startS" in args else args.get("t0"),
        frac=args.get("startFrac"),
        line_id=args.get("startLineId") or start_anchor.get("lineId"),
        word=start_anchor.get("word") or args.get("startWord"),
        at=start_anchor.get("at") or "start",
    )
    if err:
        return None, None, err
    end, err = _to_frame(
        spec,
        frame=args.get("endFrame"),
        seconds=args.get("endS") if "endS" in args else args.get("t1"),
        frac=args.get("endFrac"),
        line_id=args.get("endLineId") or end_anchor.get("lineId"),
        word=end_anchor.get("word") or args.get("endWord"),
        at=end_anchor.get("at") or "end",
    )
    if err:
        return None, None, err
    if start is None and default_start is not None:
        if default_start == "duration":
            start = spec.get("durationFrames") or 0
        else:
            start = int(default_start)
    if end is None and default_end is not None:
        if default_end == "duration":
            if spec.get("durationFrames") is None:
                if required:
                    return None, None, "scene duration is required to default the end time"
            else:
                end = int(spec["durationFrames"])
        else:
            end = int(default_end)
    start = clamp_frame(spec, start)
    end = clamp_frame(spec, end)
    if required and (start is None or end is None):
        return None, None, "provide start/end as seconds (startS/endS), a fraction (startFrac/endFrac), a line or word anchor, or frames"
    return start, end, None


def clamp_spec_timing(spec: dict) -> dict:
    """Clamp every stored startFrame/endFrame to the real scene duration."""
    bags = ("camera", "objects", "typography", "sound", "animation", "transitions")
    for bag in bags:
        items = spec.get(bag) or {}
        if not isinstance(items, dict):
            continue
        for obj in items.values():
            if not isinstance(obj, dict):
                continue
            if obj.get("startFrame") is not None:
                obj["startFrame"] = clamp_frame(spec, obj.get("startFrame"))
            if obj.get("endFrame") is not None:
                obj["endFrame"] = clamp_frame(spec, obj.get("endFrame"))
    return spec
