"""Whole-specification validation before compile/render."""
from __future__ import annotations

from typing import Any

from clips_worker.motion_studio.core.api_manifest import load_manifest
from clips_worker.motion_studio.tools.spec import SPEC_VERSION

PALETTE_KEYS = frozenset({"bg", "ink", "accent", "accent2", "muted"})


def validate_spec(spec: dict[str, Any], *, catalog_ids: list[str] | None = None) -> list[dict[str, str]]:
    """Return structured problems (empty if the spec may be compiled)."""
    problems: list[dict[str, str]] = []
    if not isinstance(spec, dict):
        return [{"code": "INVALID_SPEC", "message": "scene specification must be an object."}]
    if spec.get("version") != SPEC_VERSION:
        problems.append({"code": "UNSUPPORTED_VERSION", "message": f"unsupported spec version {spec.get('version')!r}; expected {SPEC_VERSION}."})
    if not spec.get("sceneId"):
        problems.append({"code": "MISSING_SCENE_ID", "message": "sceneId is required."})
    fps = spec.get("fps")
    if not isinstance(fps, (int, float)) or fps <= 0:
        problems.append({"code": "INVALID_RANGE", "message": "fps must be a positive number."})
    duration = spec.get("durationFrames")
    envs = spec.get("environments") or {}
    if not envs:
        problems.append({"code": "MISSING_ENVIRONMENT", "message": "the specification has no environment; call create_environment."})

    declared_assets = set((spec.get("assets") or {}) or [])
    if catalog_ids is not None:
        catalog = set(catalog_ids)
        for aid in declared_assets:
            if aid not in catalog:
                problems.append({"code": "UNKNOWN_ASSET", "message": f"asset {aid!r} is not in the approved catalog."})
    else:
        catalog = declared_assets

    ids = set(envs) | set(spec.get("objects") or {}) | set(spec.get("typography") or {}) | set(spec.get("camera") or {}) | set(spec.get("sound") or {}) | set(spec.get("animation") or {}) | set(spec.get("transitions") or {}) | set(spec.get("extensions") or {})
    # Collision: the same id reused across bags is a problem (stable IDs must be unique in the scene).
    seen: dict[str, str] = {}
    for bag in ("environments", "objects", "typography", "camera", "sound", "animation", "transitions", "extensions"):
        for key in (spec.get(bag) or {}):
            if key in seen and seen[key] != bag:
                problems.append({"code": "ID_COLLISION", "message": f"id {key!r} is used in both {seen[key]} and {bag}."})
            seen[key] = bag

    known_objects = set(spec.get("objects") or {}) | set(spec.get("typography") or {}) | set(spec.get("extensions") or {})

    for oid, obj in (spec.get("objects") or {}).items():
        eid = obj.get("environmentId")
        if eid and eid not in envs:
            problems.append({"code": "INVALID_REFERENCE", "message": f"object {oid} references missing environment {eid!r}."})
        if obj.get("kind") == "media":
            aid = obj.get("assetId")
            if not aid:
                problems.append({"code": "MISSING_MEDIA", "message": f"media object {oid} has no assetId."})
            elif catalog and aid not in catalog and aid not in declared_assets:
                problems.append({"code": "MISSING_MEDIA", "message": f"media object {oid} refers to unknown asset {aid!r}."})
        if obj.get("kind") == "group":
            for mid in obj.get("memberIds") or []:
                if mid not in known_objects:
                    problems.append({"code": "INVALID_REFERENCE", "message": f"group {oid} references missing member {mid!r}."})
        _check_palette_blob(obj.get("material") or {}, problems, f"object {oid} material")
        _check_timing(obj, duration, problems, f"object {oid}")

    for tid, typo in (spec.get("typography") or {}).items():
        eid = typo.get("environmentId")
        if eid and eid not in envs:
            problems.append({"code": "INVALID_REFERENCE", "message": f"typography {tid} references missing environment {eid!r}."})
        _check_timing(typo, duration, problems, f"typography {tid}")

    for mid, cam in (spec.get("camera") or {}).items():
        eid = cam.get("environmentId")
        if eid and eid not in envs:
            problems.append({"code": "INVALID_REFERENCE", "message": f"camera {mid} references missing environment {eid!r}."})
        start, end = cam.get("startFrame"), cam.get("endFrame")
        if start is not None and end is not None and cam.get("easing") != "hold" and int(end) <= int(start):
            problems.append({"code": "TIMING_ERROR", "message": f"camera {mid} endFrame must be > startFrame unless easing is hold."})
        if duration is not None and end is not None and int(end) > int(duration) + int(fps or 30):
            problems.append({"code": "TIMING_ERROR", "message": f"camera {mid} endFrame {end} is outside the scene duration."})
        focus = cam.get("focusTargetId")
        if focus and focus not in known_objects:
            problems.append({"code": "INVALID_REFERENCE", "message": f"camera {mid} focusTargetId {focus!r} is not in the scene."})
        for label in ("from", "to"):
            pose = cam.get(label) or {}
            if float(pose.get("zoom") or 0) <= 0:
                problems.append({"code": "INVALID_RANGE", "message": f"camera {mid} {label}.zoom must be > 0."})

    for sid, snd in (spec.get("sound") or {}).items():
        cue = snd.get("cue")
        if cue:
            kinds = _cue_kinds()
            if kinds and cue not in kinds:
                problems.append({"code": "UNSUPPORTED_VALUE", "message": f"sound {sid} cue {cue!r} is not a known film.cue kind."})
        _check_timing(snd, duration, problems, f"sound {sid}")

    for aid, anim in (spec.get("animation") or {}).items():
        target = anim.get("targetId")
        if target and target not in ids:
            problems.append({"code": "INVALID_REFERENCE", "message": f"animation {aid} references missing target {target!r}."})
        _check_timing(anim, duration, problems, f"animation {aid}")

    # Spotlight spacing: apply_effect kind=spotlight on different targets must be >= 0.25 s apart.
    spots = []
    for obj in (spec.get("objects") or {}).values():
        if obj.get("kind") == "effect" and obj.get("effectKind") == "spotlight":
            spots.append(obj)
    if fps:
        min_frames = int(round(0.25 * float(fps)))
        for i, a in enumerate(spots):
            for b in spots[i + 1 :]:
                if a.get("targetId") and b.get("targetId") and a.get("targetId") != b.get("targetId"):
                    fa, fb = a.get("startFrame"), b.get("startFrame")
                    if fa is not None and fb is not None and abs(int(fa) - int(fb)) < min_frames:
                        problems.append({
                            "code": "SPOTLIGHT_SPACING",
                            "message": f"spotlight effects {a.get('id')} and {b.get('id')} on different targets are closer than 0.25 s.",
                        })
    return problems


def _check_timing(obj: dict, duration: int | None, problems: list, label: str) -> None:
    start, end = obj.get("startFrame"), obj.get("endFrame")
    if start is not None and end is not None and int(end) < int(start):
        problems.append({"code": "TIMING_ERROR", "message": f"{label} endFrame is before startFrame."})
    if duration is not None and start is not None and int(start) < 0:
        problems.append({"code": "TIMING_ERROR", "message": f"{label} startFrame is negative."})


def _check_palette_blob(blob: dict, problems: list, label: str) -> None:
    for key in ("fill", "stroke", "from", "to", "color"):
        val = blob.get(key)
        if isinstance(val, str) and val in PALETTE_KEYS or val is None:
            continue
        if isinstance(val, str) and val not in PALETTE_KEYS and val[:1].islower() and "_" in val:
            problems.append({"code": "UNSUPPORTED_VALUE", "message": f"{label} uses unknown palette key {val!r}."})


def _cue_kinds() -> list[str]:
    try:
        return list(load_manifest().get("cueKinds") or [])
    except Exception:  # noqa: BLE001
        return []
