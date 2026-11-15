"""Whole-specification validation before compile/render."""
from __future__ import annotations

from typing import Any

from clips_worker.motion_studio.core.api_manifest import load_manifest
from clips_worker.motion_studio.tools.spec import SPEC_VERSION

PALETTE_KEYS = frozenset({"bg", "ink", "accent", "accent2", "muted"})


def _same_pose(a: object, b: object) -> bool:
    if not isinstance(a, dict) or not isinstance(b, dict):
        return False
    try:
        return all(abs(float(a[k]) - float(b[k])) < (0.002 if k in ("zoom", "rot") else 0.6)
                   for k in ("x", "y", "zoom", "rot"))
    except (ValueError, TypeError, KeyError):
        return False


def _camera_moved(a: object, b: object) -> bool:
    if not isinstance(a, dict) or not isinstance(b, dict):
        return False
    try:
        return (float(a["zoom"]) > 0 and float(b["zoom"]) > 0
                and not _same_pose(a, b))
    except (ValueError, TypeError, KeyError):
        return False


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
                # A registered component is deliberately indexed in both bags:
                # objects is the drawable scene graph, extensions is the approved
                # component dependency index. It is one object, not two IDs.
                # Do not permit unrelated records to hide behind this exception.
                original = (spec.get("objects") or {}).get(key)
                extension = (spec.get("extensions") or {}).get(key)
                same_component = (
                    {seen[key], bag} == {"objects", "extensions"}
                    and isinstance(original, dict)
                    and original.get("kind") == "extension"
                    and original == extension
                )
                if not same_component:
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
    # Film-specific intent is a mandatory contract: no slideshow substitution for requested graphics.
    required = set(spec.get("requiredEffects") or [])
    objects = spec.get("objects") or {}
    present = set()
    if any(o.get("kind") == "media" for o in objects.values()):
        present.add("media")
    if any((env.get("geometry") or (env.get("backdrop") or {}).get("elements")) for env in envs.values()):
        present.add("environment_geometry")
    if any(o.get("kind") == "group" for o in objects.values()):
        present.add("group")
    if spec.get("animation"):
        present.add("property_animation")
    if spec.get("typography"):
        present.add("typography")
    if any(tr.get("type") not in (None, "cut") for tr in (spec.get("transitions") or {}).values()):
        present.add("transition")
    if spec.get("extensions") or any(o.get("kind") == "extension" for o in objects.values()):
        present.add("custom_component")
    if any(o.get("kind") in ("path",) or (o.get("kind") == "graphic" and o.get("graphicKind") in ("route",)) for o in objects.values()):
        present.add("connector")
    if any(o.get("kind") in ("graphic", "primitive") for o in objects.values()):
        present.add("graphic")
    moves = list((spec.get("camera") or {}).values())
    if any(_camera_moved(c.get("from"), c.get("to")) and c.get("easing") != "hold" for c in moves):
        present.add("camera_travel")
    if spec.get("approvedTransitionIntent") and "transition" not in present:
        problems.append({"code": "MISSING_APPROVED_TRANSITION",
                         "message": f"transitionIntent {spec['approvedTransitionIntent']!r} has no actual dissolve/wipe transition_scene call (cuts are not effects)"})
    if spec.get("cameraIntent") == "travel" and "camera_travel" not in present:
        problems.append({"code": "CAMERA_INTENT_MISSING", "message": "the approved design requires a moving camera; use animate_camera with distinct poses"})
    if spec.get("cameraIntent") == "hold" and "camera_travel" in present:
        problems.append({"code": "CAMERA_INTENT_MISMATCH", "message": "the approved design specifies a deliberate hold, not a camera journey"})
    for feature in sorted(required - present):
        remedy = {
            "graphic": "call create_graphic or place_primitive with an approved drawable element id",
            "environment_geometry": "call create_environment with backdrop.elements for approved physical world objects",
            "camera_travel": "call animate_camera with genuinely distinct from/to camera poses",
            "property_animation": "call animate_property on the approved object",
            "transition": "call transition_scene with approved adjacent scene ids",
            "group": "call layout_group with approved memberIds",
            "custom_component": "register/place the approved custom component",
            "media": "call place_media with the approved assetId",
        }.get(feature, f"implement the approved {feature} using a supported registered tool")
        problems.append({"code": "MISSING_PLANNED_EFFECT",
                         "message": f"required effect {feature!r} is absent from the compiled scene graph; {remedy}"})
    expected_world = spec.get("requiredWorldElements") or []
    built_world = [el for e in envs.values() for el in
                   ((e.get("backdrop") or {}).get("elements") or []) + (e.get("geometry") or [])]
    world_by_id = {el.get("id"): el for el in built_world if isinstance(el, dict) and el.get("id")}
    for intended in expected_world:
        if not isinstance(intended, dict):
            continue
        eid = intended.get("id")
        actual = world_by_id.get(eid)
        if actual is None:
            problems.append({"code": "MISSING_WORLD_ELEMENT",
                             "message": f"approved world object {eid!r} is absent; copy it into create_environment.backdrop.elements"})
        elif actual.get("kind") != intended.get("kind"):
            problems.append({"code": "WORLD_ELEMENT_CHANGED",
                             "message": f"world object {eid!r}: approved kind {intended.get('kind')!r} differs from {actual.get('kind')!r}"})
        elif any(actual.get(k) != intended.get(k)
                 for k in ("position", "size", "fill", "opacity", "z", "rotation")):
            problems.append({"code": "WORLD_GEOMETRY_CHANGED",
                             "message": f"world object {eid!r}: copy the approved position, size, fill, opacity, depth and rotation exactly"})
    for shot in spec.get("plannedCameraShots") or []:
        if not isinstance(shot, dict):
            continue
        frm, to = shot.get("fromPose"), shot.get("toPose")
        if not _camera_moved(frm, to):
            continue
        if not any(_same_pose(frm, m.get("from")) and _same_pose(to, m.get("to"))
                   and m.get("easing") != "hold" for m in moves):
            problems.append({"code": "MISSING_CAMERA_SHOT",
                             "message": f"approved camera shot {shot.get('id')!r} has no real animate_camera "
                                        f"with matching numeric fromPose/toPose"})
    for aid, motion in (spec.get("animation") or {}).items():
        if motion.get("from") == motion.get("to"):
            problems.append({"code": "NOOP_ANIMATION",
                             "message": f"animation {aid!r} has identical start/end values and produces no visible movement"})
    # Check every specifically designed element by stable id, not only the presence
    # of one generic tool of the same family. An approved image cluster cannot
    # silently become one unrelated photograph.
    known = set(envs) | set(objects) | set(spec.get("typography") or {})
    for element in spec.get("compositionElements") or []:
        if not isinstance(element, dict):
            problems.append({"code": "INVALID_COMPOSITION_ELEMENT", "message": "composition element must be an object"})
            continue
        eid = element.get("id")
        if not eid or eid not in known:
            problems.append({"code": "MISSING_DESIGNED_ELEMENT", "message": f"planned element {eid!r} was not built as an object/environment with the approved id"})
            continue
        if element.get("assetId") and objects.get(eid, {}).get("assetId") != element["assetId"]:
            problems.append({"code": "WRONG_DESIGNED_ASSET", "message": f"planned element {eid!r} does not use approved asset {element['assetId']}"})
        group = element.get("groupId")
        if group and eid not in (objects.get(group) or {}).get("memberIds", []):
            problems.append({"code": "MISSING_GROUP_RELATION", "message": f"planned element {eid!r} is not a member of {group!r}"})
        linked = element.get("connectTo")
        if linked and not any(p.get("kind") == "path" and (
                {p.get("fromObjectId"), p.get("toObjectId")} == {eid, linked})
                for p in objects.values()):
            problems.append({"code": "MISSING_VISUAL_LINK", "message": f"planned elements {eid!r} and {linked!r} lack a connecting path"})
        if element.get("motion") and not any(a.get("targetId") == eid for a in (spec.get("animation") or {}).values()):
            problems.append({"code": "MISSING_ELEMENT_MOTION", "message": f"planned element {eid!r} has motion intent but no animation or camera choreography"})
    supported_props = {"position", "position.x", "position.y", "scale", "rotation", "opacity"}
    for aid, anim in (spec.get("animation") or {}).items():
        if anim.get("property") not in supported_props:
            problems.append({"code": "UNSUPPORTED_ANIMATION", "message": f"animation {aid}: {anim.get('property')!r} has no verified engine implementation"})
        if anim.get("property") in ("position",) and not (isinstance(anim.get("from"), dict) and isinstance(anim.get("to"), dict)):
            problems.append({"code": "INVALID_ANIMATION", "message": f"animation {aid}: position requires from/to positions"})
    parents = {}
    for oid, obj in objects.items():
        if obj.get("kind") != "group":
            continue
        for mid in obj.get("memberIds") or []:
            if mid in parents:
                problems.append({"code": "MULTIPLE_GROUP_PARENTS", "message": f"{mid} belongs to multiple layout groups"})
            parents[mid] = oid
    for mid in parents:
        seen, at = set(), mid
        while at in parents:
            at = parents[at]
            if at in seen:
                problems.append({"code": "GROUP_CYCLE", "message": f"{mid} has cyclic layout ancestry"})
                break
            seen.add(at)
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
