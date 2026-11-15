"""Registered creative tools (Tier 1 and Tier 2). Apply() updates a scene spec only."""
from __future__ import annotations

from typing import Any

from clips_worker.motion_studio.tools.registry import (
    AUTHORIZATION,
    INVALID_ARGUMENT,
    INVALID_DATA,
    INVALID_RANGE,
    LIMIT_EXCEEDED,
    MISSING_TARGET,
    PRECONDITION_FAILED,
    UNKNOWN_ASSET,
    UNSUPPORTED_VALUE,
    Param,
    Tool,
    ToolResult,
    error,
)
from clips_worker.motion_studio.tools.spec import (
    MAX_AUDIO_EVENTS,
    MAX_CAMERA_MOVES,
    MAX_ENVIRONMENTS,
    MAX_MEDIA,
    MAX_OBJECTS,
    MAX_PRIMITIVES,
    MAX_TRANSITIONS,
    next_id,
    resolve_scene_timing,
)

EASING = ("linear", "ease_in_out", "ease_out_cubic", "ease_out_back", "ease_in", "ease_out", "hold")
PRESENTATIONS = (
    "physical_print", "print", "framed", "glass", "tv", "screen", "filmstrip",
    "plain", "full_bleed", "footage", "clip",
)
GRAPHIC_KINDS = ("chart_line", "chart_bar", "map", "callout", "counter", "panel", "stamp", "pin", "route", "card")
PRIMITIVE_KINDS = ("rect", "rrect", "circle", "line", "path", "texture", "grain", "dot_field")
EFFECT_KINDS = ("spotlight", "grain", "shake", "damp", "hold")
AUDIO_ROLES = ("music", "voice", "effect", "cue", "silence")
ENTRANCES = ("reveal", "spring", "fade", "slide", "none", "cut")
TRANSITION_TYPES = ("cut", "dissolve", "match_cut", "shared_element", "fade", "wipe")

_COMMON_AUTH = (
    "Planning only: this tool updates the in-memory scene specification. "
    "It must not write the database, touch storage, download media, render, or publish."
)
_COMMON_SIDE = "Mutates the scene specification only. Re-compile to refresh the render plan. No live production writes."
_COMMON_PROHIBITED = (
    "Do not invent engine method names, call skia or other low-level drawing APIs, "
    "edit renderer internals, or write database or storage records."
)


def _ok(tool: str, version: str, data: dict) -> ToolResult:
    return ToolResult(True, tool, version, data=data)


def _fail(tool: str, version: str, *errs: dict) -> ToolResult:
    return ToolResult(False, tool, version, errors=list(errs))


def _env(spec: dict, environment_id: str | None) -> tuple[str | None, dict | None]:
    envs = spec.get("environments") or {}
    if environment_id:
        return environment_id, envs.get(environment_id)
    if len(envs) == 1:
        k = next(iter(envs))
        return k, envs[k]
    return environment_id, None


def _require_env(spec: dict, arguments: dict, version: str, tool: str) -> tuple[str | None, ToolResult | None]:
    eid, env = _env(spec, arguments.get("environmentId"))
    if env is None:
        return None, _fail(
            tool, version,
            error(
                PRECONDITION_FAILED if not (spec.get("environments") or {}) else MISSING_TARGET,
                "create_environment must run first, and environmentId must refer to an existing environment.",
                "Call create_environment, then pass its environmentId.",
            ),
        )
    return eid, None


def _put(spec: dict, bag: str, item_id: str, payload: dict) -> None:
    spec.setdefault(bag, {})[item_id] = payload


def _asset_ok(spec: dict, asset_id: str) -> bool:
    if not asset_id:
        return False
    assets = spec.get("assets") or {}
    if not assets:
        return True  # catalog may be attached later; whole-spec validation catches misses
    return asset_id in assets


# ----- create_environment -----

def _create_environment(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    envs = spec.setdefault("environments", {})
    if len(envs) >= MAX_ENVIRONMENTS:
        return _fail("create_environment", version, error(LIMIT_EXCEEDED, f"at most {MAX_ENVIRONMENTS} environments per scene."))
    eid = arguments.get("environmentId") or next_id(spec, "env")
    if eid in envs:
        return _fail("create_environment", version, error(INVALID_DATA, f"environment {eid!r} already exists.", "Reuse it or choose a new environmentId."))
    # Worlds are invented per story — kind is a free brief, not a WORLD_TYPES enum.
    payload = {
        "id": eid,
        "brief": arguments["brief"],
        "artDirection": arguments.get("artDirection") or {},
        "palette": arguments.get("palette") or {},
        "size": arguments.get("size") or {"width": 3840, "height": 2160},
        "materials": arguments.get("materials") or [],
        "backdrop": arguments.get("backdrop") or {},
    }
    palette = payload["palette"]
    if palette:
        allowed = {"bg", "ink", "accent", "accent2", "muted"}
        bad = [k for k in palette if k not in allowed]
        if bad:
            return _fail(
                "create_environment", version,
                error(UNSUPPORTED_VALUE, f"unknown palette keys {bad}. Only {sorted(allowed)} exist.", "Use bg, ink, accent, accent2, muted."),
            )
    _put(spec, "environments", eid, payload)
    return _ok("create_environment", version, {"id": eid, "environmentId": eid})


# ----- place_media -----

def _place_media(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "place_media"
    if arguments.get("sceneId") and spec.get("sceneId") and arguments["sceneId"] != spec["sceneId"]:
        return _fail(tool, version, error(INVALID_DATA, f"sceneId {arguments['sceneId']!r} does not match spec {spec['sceneId']!r}."))
    media_count = sum(1 for o in (spec.get("objects") or {}).values() if o.get("kind") == "media")
    if media_count >= MAX_MEDIA or len(spec.get("objects") or {}) >= MAX_OBJECTS:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_MEDIA} media placements and {MAX_OBJECTS} objects per scene."))
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    asset_id = arguments["assetId"]
    if not _asset_ok(spec, asset_id):
        return _fail(tool, version, error(UNKNOWN_ASSET, f"asset {asset_id!r} is not in the scene catalog.", "Use an id from the approved media catalog / blueprint."))
    pos = arguments.get("position") or {}
    if not isinstance(pos, dict) or "x" not in pos or "y" not in pos:
        return _fail(tool, version, error(INVALID_ARGUMENT, "position must be an object with x and y.", "Pass position: {\"x\": ..., \"y\": ...}."))
    oid = arguments.get("objectId") or next_id(spec, "media")
    payload = {
        "id": oid,
        "kind": "media",
        "environmentId": eid,
        "assetId": asset_id,
        "presentation": arguments.get("presentation") or "physical_print",
        "position": {"x": pos["x"], "y": pos["y"]},
        "width": arguments.get("width"),
        "height": arguments.get("height"),
        "rotation": arguments.get("rotation") or 0,
        "crop": arguments.get("crop"),
        "entrance": arguments.get("entrance") or {"type": "reveal"},
        "z": arguments.get("z", 20),
        "label": arguments.get("label") or "",
        "title": arguments.get("title") or "",
    }
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "objectId": oid, "environmentId": eid, "assetId": asset_id})


# ----- animate_camera -----

def _cam_pose(value: Any, label: str, version: str) -> tuple[dict | None, ToolResult | None]:
    if not isinstance(value, dict) or not all(k in value for k in ("x", "y", "zoom")):
        return None, _fail(
            "animate_camera", version,
            error(INVALID_ARGUMENT, f"{label} must include x, y and zoom (rot is optional).", "Pass {x, y, zoom, rot?}."),
        )
    zoom = float(value["zoom"])
    if zoom <= 0:
        return None, _fail("animate_camera", version, error(INVALID_RANGE, f"{label}.zoom must be > 0."))
    return {"x": float(value["x"]), "y": float(value["y"]), "zoom": zoom, "rot": float(value.get("rot") or 0.0)}, None


def _animate_camera(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "animate_camera"
    if len(spec.get("camera") or {}) >= MAX_CAMERA_MOVES:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_CAMERA_MOVES} camera moves per scene."))
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    start_i, end_i, terr = resolve_scene_timing(
        spec, arguments, default_start=0, default_end="duration", required=True,
    )
    if terr:
        return _fail(tool, version, error(INVALID_ARGUMENT, terr))
    easing = arguments.get("easing") or "ease_in_out"
    # A deliberate hold may use start == end; any other movement needs a positive interval.
    if easing != "hold" and end_i <= start_i:
        return _fail(tool, version, error(INVALID_RANGE, "endFrame must be greater than startFrame unless easing is 'hold'.", "Widen the frame interval or use easing='hold'."))
    if easing == "hold" and end_i < start_i:
        return _fail(tool, version, error(INVALID_RANGE, "hold endFrame must be >= startFrame."))
    frm, ferr = _cam_pose(arguments.get("from"), "from", version)
    if ferr:
        return ferr
    to, terr = _cam_pose(arguments.get("to"), "to", version)
    if terr:
        return terr
    focus = arguments.get("focusTargetId")
    if focus and focus not in (spec.get("objects") or {}) and focus not in (spec.get("typography") or {}):
        return _fail(tool, version, error(MISSING_TARGET, f"focusTargetId {focus!r} is not an object in this scene.", "Place the target first, or omit focusTargetId."))
    mid = arguments.get("motionId") or next_id(spec, "cam")
    payload = {
        "id": mid,
        "environmentId": eid,
        "startFrame": start_i,
        "endFrame": end_i,
        "from": frm,
        "to": to,
        "easing": easing,
        "focusTargetId": focus,
    }
    _put(spec, "camera", mid, payload)
    return _ok(tool, version, {"id": mid, "motionId": mid, "environmentId": eid})


# ----- create_graphic -----

def _create_graphic(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "create_graphic"
    if len(spec.get("objects") or {}) >= MAX_OBJECTS:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_OBJECTS} objects per scene."))
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    kind = arguments["kind"]
    data = arguments.get("data")
    if kind in ("chart_line", "chart_bar") and not _verified_series(data):
        return _fail(
            tool, version,
            error(INVALID_DATA, f"{kind} requires verified numeric series data (list of {{x, y}} or {{label, value}}).", "Pass data from the approved blueprint / ctx.data, never invented numbers."),
        )
    if kind in ("map", "pin", "route") and not (arguments.get("data") or arguments.get("places") or arguments.get("path")):
        return _fail(tool, version, error(INVALID_DATA, f"{kind} requires verified geographic data (places or path).", "Pass coordinates or named places from the blueprint."))
    oid = arguments.get("objectId") or next_id(spec, "graphic")
    pos = arguments.get("position") or {"x": 0, "y": 0}
    payload = {
        "id": oid,
        "kind": "graphic",
        "graphicKind": kind,
        "environmentId": eid,
        "data": data,
        "places": arguments.get("places"),
        "path": arguments.get("path"),
        "position": pos,
        "width": arguments.get("width"),
        "height": arguments.get("height"),
        "style": arguments.get("style") or {},
        "title": arguments.get("title") or "",
        "entrance": arguments.get("entrance") or {"type": "reveal"},
        "z": arguments.get("z", 25),
    }
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "objectId": oid})


def _verified_series(data: Any) -> bool:
    if not isinstance(data, list) or not data:
        return False
    for row in data:
        if isinstance(row, (int, float)):
            continue
        if isinstance(row, (list, tuple)) and len(row) >= 2 and all(isinstance(x, (int, float, str)) for x in row[:2]):
            continue
        if isinstance(row, dict) and any(k in row for k in ("y", "value", "v")):
            continue
        return False
    return True


# ----- transition_scene -----

def _transition_scene(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "transition_scene"
    if len(spec.get("transitions") or {}) >= MAX_TRANSITIONS:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_TRANSITIONS} transitions per scene."))
    tid = arguments.get("transitionId") or next_id(spec, "tr")
    payload = {
        "id": tid,
        "type": arguments.get("type") or "cut",
        "fromSceneId": arguments.get("fromSceneId"),
        "toSceneId": arguments.get("toSceneId") or spec.get("sceneId"),
        "sharedObjectIds": arguments.get("sharedObjectIds") or [],
        "params": arguments.get("params") or {},
    }
    start_i, end_i, terr = resolve_scene_timing(spec, arguments)
    if terr:
        return _fail(tool, version, error(INVALID_ARGUMENT, terr))
    payload["startFrame"], payload["endFrame"] = start_i, end_i
    if payload["startFrame"] is not None and payload["endFrame"] is not None and int(payload["endFrame"]) < int(payload["startFrame"]):
        return _fail(tool, version, error(INVALID_RANGE, "transition endFrame must be >= startFrame."))
    _put(spec, "transitions", tid, payload)
    return _ok(tool, version, {"id": tid, "transitionId": tid})


# ----- compose_audio -----

def _compose_audio(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "compose_audio"
    if len(spec.get("sound") or {}) >= MAX_AUDIO_EVENTS:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_AUDIO_EVENTS} audio events per scene."))
    sid = arguments.get("soundId") or next_id(spec, "sfx")
    payload = {
        "id": sid,
        "role": arguments["role"],
        "cue": arguments.get("cue"),
        "gain": arguments.get("gain", 1.0),
        "anchorWordId": arguments.get("anchorWordId"),
        "bed": arguments.get("bed") or False,
    }
    start_i, end_i, terr = resolve_scene_timing(spec, arguments)
    if terr:
        return _fail(tool, version, error(INVALID_ARGUMENT, terr))
    payload["startFrame"], payload["endFrame"] = start_i, end_i
    _put(spec, "sound", sid, payload)
    return _ok(tool, version, {"id": sid, "soundId": sid})


# ----- animate_text -----

def _animate_text(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "animate_text"
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    tid = arguments.get("typeId") or next_id(spec, "type")
    payload = {
        "id": tid,
        "kind": "type",
        "environmentId": eid,
        "text": arguments["text"],
        "position": arguments.get("position") or {"x": 0, "y": 0},
        "size": arguments.get("size") or 120,
        "style": arguments.get("style") or {},
        "anchorWordId": arguments.get("anchorWordId"),
        "entrance": arguments.get("entrance") or {"type": "reveal"},
        "role": arguments.get("role") or "title",
        "z": arguments.get("z", 40),
    }
    _put(spec, "typography", tid, payload)
    return _ok(tool, version, {"id": tid, "typeId": tid})


# ----- draw_path / place_primitive / set_material / animate_property / apply_effect / layout_group / use_component -----

def _draw_path(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "draw_path"
    if len(spec.get("objects") or {}) >= MAX_PRIMITIVES:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_PRIMITIVES} primitives per scene."))
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    points = arguments.get("points") or arguments.get("path")
    if not isinstance(points, list) or len(points) < 2:
        return _fail(tool, version, error(INVALID_ARGUMENT, "draw_path requires at least two points.", "Pass points: [{x,y}, ...]."))
    oid = arguments.get("objectId") or next_id(spec, "path")
    payload = {
        "id": oid,
        "kind": "path",
        "environmentId": eid,
        "points": points,
        "width": arguments.get("width") or 6,
        "style": arguments.get("style") or {},
        "entrance": arguments.get("entrance") or {"type": "none"},
        "z": arguments.get("z", 15),
    }
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "objectId": oid})


def _place_primitive(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "place_primitive"
    if len(spec.get("objects") or {}) >= MAX_PRIMITIVES:
        return _fail(tool, version, error(LIMIT_EXCEEDED, f"at most {MAX_PRIMITIVES} primitives per scene."))
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    oid = arguments.get("objectId") or next_id(spec, "prim")
    payload = {
        "id": oid,
        "kind": "primitive",
        "primitiveKind": arguments["kind"],
        "environmentId": eid,
        "position": arguments.get("position") or {"x": 0, "y": 0},
        "size": arguments.get("size") or {},
        "path": arguments.get("path"),
        "material": arguments.get("material") or {},
        "z": arguments.get("z", 5),
    }
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "objectId": oid})


def _set_material(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "set_material"
    target = arguments["targetId"]
    bag = None
    for name in ("objects", "typography", "environments"):
        if target in (spec.get(name) or {}):
            bag = name
            break
    if bag is None:
        return _fail(tool, version, error(MISSING_TARGET, f"targetId {target!r} is not in the scene.", "Create the object first."))
    mat = arguments.get("material") or {}
    spec[bag][target]["material"] = {**(spec[bag][target].get("material") or {}), **mat}
    return _ok(tool, version, {"id": target, "targetId": target})


def _animate_property(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "animate_property"
    target = arguments["targetId"]
    found = any(target in (spec.get(b) or {}) for b in ("objects", "typography", "environments", "camera"))
    if not found:
        return _fail(tool, version, error(MISSING_TARGET, f"targetId {target!r} is not in the scene."))
    aid = arguments.get("animationId") or next_id(spec, "anim")
    payload = {
        "id": aid,
        "targetId": target,
        "property": arguments["property"],
        "from": arguments.get("from"),
        "to": arguments.get("to"),
        "easing": arguments.get("easing") or "ease_in_out",
    }
    start_i, end_i, terr = resolve_scene_timing(spec, arguments)
    if terr:
        return _fail(tool, version, error(INVALID_ARGUMENT, terr))
    payload["startFrame"], payload["endFrame"] = start_i, end_i
    if payload["startFrame"] is not None and payload["endFrame"] is not None and int(payload["endFrame"]) < int(payload["startFrame"]):
        return _fail(tool, version, error(INVALID_RANGE, "animation endFrame must be >= startFrame."))
    _put(spec, "animation", aid, payload)
    return _ok(tool, version, {"id": aid, "animationId": aid})


def _apply_effect(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "apply_effect"
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    oid = arguments.get("effectId") or next_id(spec, "fx")
    payload = {
        "id": oid,
        "kind": "effect",
        "effectKind": arguments["kind"],
        "environmentId": eid,
        "targetId": arguments.get("targetId"),
        "params": arguments.get("params") or {},
    }
    start_i, end_i, terr = resolve_scene_timing(spec, arguments)
    if terr:
        return _fail(tool, version, error(INVALID_ARGUMENT, terr))
    payload["startFrame"], payload["endFrame"] = start_i, end_i
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "effectId": oid})


def _layout_group(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "layout_group"
    members = arguments.get("memberIds") or []
    missing = [m for m in members if m not in (spec.get("objects") or {}) and m not in (spec.get("typography") or {})]
    if missing:
        return _fail(tool, version, error(MISSING_TARGET, f"layout members not in the scene: {missing}."))
    oid = arguments.get("groupId") or next_id(spec, "group")
    payload = {
        "id": oid,
        "kind": "group",
        "memberIds": list(members),
        "layout": arguments.get("layout") or "free",
        "position": arguments.get("position") or {"x": 0, "y": 0},
    }
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "groupId": oid})


def _use_component(spec: dict, arguments: dict) -> ToolResult:
    version = "pending"
    tool = "use_component"
    # Privileged registration is not this tool — that path is extensions.register_component.
    if arguments.get("code"):
        return _fail(
            tool, version,
            error(AUTHORIZATION, "use_component cannot register raw code. Register a validated component first.", "Call the extension registrar after lint, sandbox and visual tests, then use_component with the registered name and version."),
        )
    eid, err = _require_env(spec, arguments, version, tool)
    if err:
        return err
    oid = arguments.get("objectId") or next_id(spec, "ext")
    payload = {
        "id": oid,
        "kind": "extension",
        "component": arguments["component"],
        "componentVersion": arguments.get("componentVersion"),
        "environmentId": eid,
        "arguments": arguments.get("componentArguments") or {},
        "position": arguments.get("position") or {"x": 0, "y": 0},
    }
    _put(spec, "extensions", oid, payload)
    _put(spec, "objects", oid, payload)
    return _ok(tool, version, {"id": oid, "objectId": oid})


def _bind(tool: Tool) -> Tool:
    """Fill the version string on results now that the Tool exists."""
    original = tool.apply_fn

    def wrapped(spec: dict, arguments: dict) -> ToolResult:
        result = original(spec, arguments)
        result.version = tool.version()
        return result

    tool.apply_fn = wrapped
    return tool


def all_tools() -> list[Tool]:
    tools = [
        Tool(
            name="create_environment",
            tier=1,
            purpose="Create a custom visual space for this scene. Environments are invented for the story; this is not a world-type template picker.",
            when_to_use="When the scene needs a visual space (desk, map space, invented interior, graphic field, etc.) before objects are placed.",
            when_not_to_use="Do not call it to pick a stock city tour or a fixed WORLD_TYPES enum entry. Do not use it to place media or move the camera.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["A scene specification exists."],
            dependencies=[],
            behavior="Validate palette keys and limits, add an environment to the specification, and return its environmentId.",
            errors={
                LIMIT_EXCEEDED: "Remove an unused environment or split the scene.",
                UNSUPPORTED_VALUE: "Use only palette keys bg, ink, accent, accent2, muted.",
                INVALID_DATA: "Choose a new environmentId; do not collide with an existing one.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_ENVIRONMENTS} environments per scene.",
            reversible=True,
            defaults="size defaults to 3840x2160; palette and materials default to empty and are filled from film identity later.",
            parameters=[
                Param("environmentId", "string", False, "Stable id for this environment. Generated if omitted."),
                Param("brief", "string", True, "Story-driven description of the space (invented, not a template name)."),
                Param("artDirection", "object", False, "Materials, light, and finish notes from the film identity."),
                Param("palette", "object", False, "Optional palette overrides; keys must be bg, ink, accent, accent2, muted."),
                Param("size", "object", False, "World size {width, height} in 4K world pixels."),
                Param("materials", "array", False, "Free-form material notes (paper, wood, grain, glass, etc.)."),
                Param("backdrop", "object", False, "Backdrop hints (color, gradient, texture) — primitives, not a world template."),
            ],
            examples=[{
                "tool": "create_environment",
                "arguments": {
                    "environmentId": "env_desk",
                    "brief": "A worn physical desk under a practical lamp, papers at the edges, room for a single print.",
                    "materials": ["paper", "wood grain"],
                    "backdrop": {"kind": "gradient", "from": "bg", "to": "muted"},
                },
            }],
            apply_fn=_create_environment,
        ),
        Tool(
            name="place_media",
            tier=1,
            purpose="Position a photograph or footage item in an environment. The agent chooses placement, presentation and entrance; trusted code loads, crops and renders.",
            when_to_use="When an approved still or clip should appear in the scene (print on a desk, framed still, screen, footage window, full-bleed plate).",
            when_not_to_use="Do not use it to invent an asset that is not in the catalog, or to draw a chart or typography.",
            prohibited=_COMMON_PROHIBITED + " Do not pick random media or substitute an unassigned still.",
            preconditions=["An environment exists.", "assetId refers to an approved catalog/blueprint asset when the catalog is attached."],
            dependencies=["create_environment"],
            behavior="Validate the environment, asset, position and limits; add a media object to the specification; return the objectId. The compiler emits a PhotoFrame (or footage handoff placement on the same rect).",
            errors={
                PRECONDITION_FAILED: "Call create_environment first.",
                UNKNOWN_ASSET: "Use an asset id from the approved catalog or blueprint.",
                INVALID_ARGUMENT: "Pass position {x, y} and a supported presentation.",
                LIMIT_EXCEEDED: "Remove an unused placement or split the scene.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_MEDIA} media placements per scene.",
            reversible=True,
            defaults="presentation defaults to physical_print; rotation defaults to 0; entrance defaults to reveal.",
            parameters=[
                Param("sceneId", "string", False, "Must match the specification's sceneId when provided."),
                Param("assetId", "string", True, "Approved catalog/blueprint asset id."),
                Param("presentation", "string", False, "How the media sits in the world.", allowed=list(PRESENTATIONS), default="physical_print"),
                Param("position", "object", True, "World position {x, y}."),
                Param("width", "number", False, "Requested width in world pixels (clamped to source resolution by the engine)."),
                Param("height", "number", False, "Optional height; otherwise preserved from the asset aspect."),
                Param("rotation", "number", False, "Rotation in degrees.", default=0),
                Param("crop", "array", False, "Normalized crop [cx0, cy0, cx1, cy1]."),
                Param("entrance", "object", False, "Entrance {type, anchorWordId?}."),
                Param("environmentId", "string", False, "Target environment; defaults to the sole environment."),
                Param("objectId", "string", False, "Stable object id. Generated if omitted."),
                Param("z", "number", False, "Z-order.", default=20),
                Param("label", "string", False, "Optional callout label."),
                Param("title", "string", False, "Optional caption."),
            ],
            examples=[{
                "tool": "place_media",
                "arguments": {
                    "sceneId": "scene_12",
                    "assetId": "photo_7",
                    "presentation": "physical_print",
                    "position": {"x": 1250, "y": 400},
                    "width": 1800,
                    "rotation": -3,
                    "entrance": {"type": "reveal", "anchorWordId": "word_214"},
                },
            }],
            apply_fn=_place_media,
            aliases=("place_photo",),
        ),
        Tool(
            name="animate_camera",
            tier=1,
            purpose="Create a deterministic camera movement within an existing environment. Used to direct attention toward objects, transition between visual clusters, or reveal relationships between subjects.",
            when_to_use="When the story needs a camera push, pull-back, pan, tracking movement, reveal or deliberate hold.",
            when_not_to_use="Do not use it to place objects, invent camera method names, or hold with a second film.shot() closer than 0.25 s on a new target.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["An environment exists.", "focusTargetId, if set, refers to an existing object."],
            dependencies=["create_environment"],
            behavior="Validate the target, timing window, camera constraints and easing type; convert relative times to frames from the real scene duration; generate camera keyframes on the specification; return the generated motionId. A hold may use a zero-length window with easing='hold'. Prefer startS/endS, startFrac/endFrac, or line anchors — do not compute frames.",
            errors={
                PRECONDITION_FAILED: "Call create_environment first.",
                MISSING_TARGET: "Place the focus target first, or omit focusTargetId.",
                INVALID_RANGE: "Use a positive frame interval, or easing='hold' for a still camera.",
                UNSUPPORTED_VALUE: f"Use one of {list(EASING)}.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_CAMERA_MOVES} camera moves per scene.",
            reversible=True,
            defaults="easing defaults to ease_in_out; rot defaults to 0.",
            parameters=[
                Param("environmentId", "string", False, "Existing environment containing the camera. Defaults to the sole environment."),
                Param("startS", "number", False, "Start time in seconds from the beginning of this scene. Preferred. The engine converts to frames."),
                Param("endS", "number", False, "End time in seconds from the beginning of this scene, or 'end' for the real scene duration."),
                Param("startFrac", "number", False, "Start as a fraction of this scene's duration (0..1)."),
                Param("endFrac", "number", False, "End as a fraction of this scene's duration (0..1). Use 1 for the end of the scene."),
                Param("startLineId", "string", False, "Start at the official start of this narration line."),
                Param("endLineId", "string", False, "End at the official end of this narration line."),
                Param("startFrame", "integer", False, "Legacy start frame. Optional. Prefer startS/startFrac/startLineId; the engine clamps to the real duration."),
                Param("endFrame", "integer", False, "Legacy end frame. Optional. Prefer endS/endFrac/endLineId; the engine clamps to the real duration."),
                Param("from", "object", True, "Start pose {x, y, zoom, rot?}."),
                Param("to", "object", True, "End pose {x, y, zoom, rot?}."),
                Param("easing", "string", False, "Supported movement profile.", allowed=list(EASING), default="ease_in_out"),
                Param("focusTargetId", "string", False, "Optional existing object to emphasize (spotlight)."),
                Param("motionId", "string", False, "Stable motion id. Generated if omitted."),
            ],
            examples=[{
                "tool": "animate_camera",
                "arguments": {
                    "environmentId": "env_desk",
                    "startS": 0,
                    "endS": 3,
                    "from": {"x": 0, "y": 0, "zoom": 0.35, "rot": 0},
                    "to": {"x": 1250, "y": 400, "zoom": 0.7, "rot": 0},
                    "easing": "ease_in_out",
                    "focusTargetId": "media_1",
                },
            }],
            apply_fn=_animate_camera,
        ),
        Tool(
            name="create_graphic",
            tier=1,
            purpose="Create a chart, map, callout, counter or other structured graphic from verified data and arguments.",
            when_to_use="When the blueprint calls for a chart, map annotation, callout, pin, route, stamp or similar graphic built from approved data.",
            when_not_to_use="Do not invent numeric or geographic data. Do not use this to place a photo (use place_media) or to write a new procedural component (use the extension path).",
            prohibited=_COMMON_PROHIBITED + " Do not fabricate series values.",
            preconditions=["An environment exists.", "Chart/map kinds include verified data from the blueprint."],
            dependencies=["create_environment"],
            behavior="Verify required data, add a graphic object to the specification, and return its objectId. The compiler maps kinds onto motion_core classes (LineSeries, BarSeries, MapPin, Route, Callout, etc.).",
            errors={
                PRECONDITION_FAILED: "Call create_environment first.",
                INVALID_DATA: "Pass verified numeric or geographic data from the blueprint.",
                UNSUPPORTED_VALUE: f"Use one of {list(GRAPHIC_KINDS)}.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_OBJECTS} objects per scene.",
            reversible=True,
            defaults="position defaults to the origin; entrance defaults to reveal.",
            parameters=[
                Param("kind", "string", True, "Graphic kind.", allowed=list(GRAPHIC_KINDS)),
                Param("data", "array", False, "Verified series or structured data from the blueprint."),
                Param("places", "array", False, "Verified named or coordinate places for map graphics."),
                Param("path", "array", False, "Verified path for a route."),
                Param("position", "object", False, "World position {x, y}."),
                Param("width", "number", False, "Width in world pixels."),
                Param("height", "number", False, "Height in world pixels."),
                Param("style", "object", False, "Color and typography hints using official palette keys."),
                Param("title", "string", False, "Optional title."),
                Param("entrance", "object", False, "Entrance {type, anchorWordId?}."),
                Param("environmentId", "string", False, "Target environment."),
                Param("objectId", "string", False, "Stable object id."),
                Param("z", "number", False, "Z-order.", default=25),
            ],
            examples=[{
                "tool": "create_graphic",
                "arguments": {
                    "kind": "chart_line",
                    "data": [{"x": "2019", "y": 4.2}, {"x": "2020", "y": 8.1}, {"x": "2021", "y": 12.0}],
                    "position": {"x": 0, "y": 200},
                    "width": 2200,
                    "height": 900,
                    "title": "Revenue",
                },
            }],
            apply_fn=_create_graphic,
        ),
        Tool(
            name="transition_scene",
            tier=1,
            purpose="Connect this scene to another (or its own in/out) with a parameterized transition, including shared-element continuity. Not a fixed transition template pack.",
            when_to_use="When the editorial plan or blueprint specifies how this scene should enter, exit, or share an element with a neighbor.",
            when_not_to_use="Do not use it to move the camera inside a scene (animate_camera) or to invent a transition that contradicts the editorial plan.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["fromSceneId / toSceneId refer to planned scenes when provided."],
            dependencies=[],
            behavior="Record a versioned transition on the specification and return its transitionId. The compiler and assembler honor the type and shared object ids.",
            errors={
                INVALID_RANGE: "endFrame must be >= startFrame.",
                UNSUPPORTED_VALUE: f"Use one of {list(TRANSITION_TYPES)}.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_TRANSITIONS} transitions per scene.",
            reversible=True,
            defaults="type defaults to cut; toSceneId defaults to this scene.",
            parameters=[
                Param("type", "string", False, "Transition type (parameterized, not a fixed pack).", allowed=list(TRANSITION_TYPES), default="cut"),
                Param("fromSceneId", "string", False, "Outgoing scene id."),
                Param("toSceneId", "string", False, "Incoming scene id."),
                Param("startS", "number", False, "Start time in seconds from the beginning of this scene. The engine converts to frames."),
                Param("endS", "number", False, "End time in seconds, or the end of the scene."),
                Param("startFrame", "integer", False, "Legacy start frame; prefer startS. The engine clamps to the real duration."),
                Param("endFrame", "integer", False, "Legacy end frame; prefer endS. The engine clamps to the real duration."),
                Param("sharedObjectIds", "array", False, "Objects that persist across the transition."),
                Param("params", "object", False, "Type-specific parameters (duration, direction, etc.)."),
                Param("transitionId", "string", False, "Stable id."),
            ],
            examples=[{
                "tool": "transition_scene",
                "arguments": {
                    "type": "shared_element",
                    "fromSceneId": "scene_11",
                    "toSceneId": "scene_12",
                    "sharedObjectIds": ["media_1"],
                    "startFrame": 0,
                    "endFrame": 12,
                },
            }],
            apply_fn=_transition_scene,
        ),
        Tool(
            name="compose_audio",
            tier=1,
            purpose="Add music, voice, silence or effect cues to the scene specification. Does not invent an audio engine; it records intent for the deterministic mixer and film.cue.",
            when_to_use="When the blueprint calls for a cue, a bed, a paused-narration window, or a word-anchored sound.",
            when_not_to_use="Do not use it to synthesize audio, write files, or override the authorized mixer / true-peak limiter.",
            prohibited=_COMMON_PROHIBITED + " Do not write audio files or bypass the mixer's authorization.",
            preconditions=[],
            dependencies=[],
            behavior="Record a sound event on the specification and return its soundId. The compiler emits film.cue(...) for effect roles; beds and voice remain with the authorized audio pipeline.",
            errors={
                UNSUPPORTED_VALUE: f"Use one of {list(AUDIO_ROLES)}.",
                LIMIT_EXCEEDED: "Remove an unused cue.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_AUDIO_EVENTS} audio events per scene.",
            reversible=True,
            defaults="gain defaults to 1.0.",
            parameters=[
                Param("role", "string", True, "Audio role.", allowed=list(AUDIO_ROLES)),
                Param("cue", "string", False, "Effect kind for role=cue or role=effect (must be a known film.cue kind when set)."),
                Param("gain", "number", False, "Linear gain.", default=1.0),
                Param("startFrame", "integer", False, "Start frame."),
                Param("endFrame", "integer", False, "End frame."),
                Param("anchorWordId", "string", False, "Stable word-timing id."),
                Param("bed", "boolean", False, "True if this is a continuous bed (handled by the authorized mixer)."),
                Param("soundId", "string", False, "Stable id."),
            ],
            examples=[{
                "tool": "compose_audio",
                "arguments": {"role": "cue", "cue": "whoosh", "startFrame": 0, "gain": 0.8},
            }],
            apply_fn=_compose_audio,
        ),
        Tool(
            name="animate_text",
            tier=1,
            purpose="Place and time typography, including narration-synchronized kinetic type, using official word-timing ids.",
            when_to_use="When the blueprint calls for a title, lower third, label, or word-synced kinetic line.",
            when_not_to_use="Do not use it to place a photo or to invent a word clock. Time anchors must be official word ids or explicit frames.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["An environment exists."],
            dependencies=["create_environment"],
            behavior="Add a typography object to the specification and return its typeId. The compiler emits HeroSlam, LowerThird, BigText or Item text timed with ctx.W / word ids.",
            errors={PRECONDITION_FAILED: "Call create_environment first."},
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_OBJECTS} typography/objects per scene.",
            reversible=True,
            defaults="size defaults to 120; role defaults to title.",
            parameters=[
                Param("text", "string", True, "The string to display."),
                Param("position", "object", False, "World position {x, y}."),
                Param("size", "number", False, "Type size in world pixels.", default=120),
                Param("style", "object", False, "Weight, tracking, and palette-key color hints."),
                Param("anchorWordId", "string", False, "Stable word-timing id to sync the entrance."),
                Param("entrance", "object", False, "Entrance {type, anchorWordId?}."),
                Param("role", "string", False, "title | label | lower_third | kinetic.", default="title"),
                Param("environmentId", "string", False, "Target environment."),
                Param("typeId", "string", False, "Stable id."),
                Param("z", "number", False, "Z-order.", default=40),
            ],
            examples=[{
                "tool": "animate_text",
                "arguments": {
                    "text": "The last store",
                    "position": {"x": 0, "y": -400},
                    "size": 160,
                    "anchorWordId": "word_214",
                    "role": "kinetic",
                },
            }],
            apply_fn=_animate_text,
            aliases=("place_type",),
        ),
        Tool(
            name="draw_path",
            tier=2,
            purpose="Draw a free path (route, string, underline, handwritten mark) from points or a curve in the environment.",
            when_to_use="When the design needs a custom path that is not a stock chart or map tool output.",
            when_not_to_use="Do not use it to move the camera or to invent a skia drawing call.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["An environment exists.", "At least two points are provided."],
            dependencies=["create_environment"],
            behavior="Validate the point list, add a path object to the specification, and return its objectId. The compiler emits Connector, StringLine, Route or a path Item.",
            errors={
                INVALID_ARGUMENT: "Pass at least two points: [{x,y}, ...].",
                PRECONDITION_FAILED: "Call create_environment first.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_PRIMITIVES} primitives per scene.",
            reversible=True,
            defaults="width defaults to 6; entrance defaults to none.",
            parameters=[
                Param("points", "array", False, "List of {x, y} points. Required unless path is set."),
                Param("path", "array", False, "Alias of points."),
                Param("width", "number", False, "Stroke width.", default=6),
                Param("style", "object", False, "Stroke style (palette key, dash, sag)."),
                Param("entrance", "object", False, "Entrance {type, anchorWordId?}."),
                Param("environmentId", "string", False, "Target environment."),
                Param("objectId", "string", False, "Stable id."),
                Param("z", "number", False, "Z-order.", default=15),
            ],
            examples=[{
                "tool": "draw_path",
                "arguments": {
                    "points": [{"x": 0, "y": 0}, {"x": 800, "y": 40}, {"x": 1400, "y": -20}],
                    "width": 8,
                    "style": {"look": "string"},
                },
            }],
            apply_fn=_draw_path,
        ),
        Tool(
            name="place_primitive",
            tier=2,
            purpose="Place a primitive shape, path, or texture so the agent can compose entirely new visual structures from validated instructions.",
            when_to_use="When building a custom composition from shapes, paths and textures rather than a higher-level media/graphic tool.",
            when_not_to_use="Prefer place_media, create_graphic, or animate_text when those already express the design. Do not use this to call skia directly.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["An environment exists."],
            dependencies=["create_environment"],
            behavior="Add a primitive object to the specification and return its objectId. Combinations are arbitrary; this is not a template.",
            errors={PRECONDITION_FAILED: "Call create_environment first.", UNSUPPORTED_VALUE: f"Use one of {list(PRIMITIVE_KINDS)}."},
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_PRIMITIVES} primitives per scene.",
            reversible=True,
            defaults="position defaults to the origin.",
            parameters=[
                Param("kind", "string", True, "Primitive kind.", allowed=list(PRIMITIVE_KINDS)),
                Param("position", "object", False, "World position {x, y}."),
                Param("size", "object", False, "{width, height, radius, ...}."),
                Param("path", "array", False, "Optional path points."),
                Param("material", "object", False, "Fill, stroke, texture, grain."),
                Param("environmentId", "string", False, "Target environment."),
                Param("objectId", "string", False, "Stable id."),
                Param("z", "number", False, "Z-order.", default=5),
            ],
            examples=[{
                "tool": "place_primitive",
                "arguments": {
                    "kind": "rrect",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 1600, "height": 900, "radius": 24},
                    "material": {"fill": "bg", "stroke": "ink"},
                },
            }],
            apply_fn=_place_primitive,
        ),
        Tool(
            name="set_material",
            tier=2,
            purpose="Apply or update a material (fill, stroke, texture, grain, finish) on an existing object, typography item, or environment.",
            when_to_use="When the design needs a custom finish on an object that already exists in the specification.",
            when_not_to_use="Do not invent palette keys. Do not use this to move or create objects.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["targetId exists in the specification."],
            dependencies=[],
            behavior="Merge the material onto the target and return the targetId.",
            errors={MISSING_TARGET: "Create the target first."},
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits="One material merge per call; object limits still apply.",
            reversible=True,
            defaults="Materials merge onto any existing material dict.",
            parameters=[
                Param("targetId", "string", True, "Existing environment, object, or typography id."),
                Param("material", "object", True, "Material fields to merge (fill, stroke, texture, grain, opacity)."),
            ],
            examples=[{"tool": "set_material", "arguments": {"targetId": "prim_1", "material": {"fill": "bg", "grain": 0.08}}}],
            apply_fn=_set_material,
        ),
        Tool(
            name="animate_property",
            tier=2,
            purpose="Animate an arbitrary property of an existing object along a validated curve (position, opacity, rotation, scale, width, etc.).",
            when_to_use="When a custom motion path or fade is required on an object the higher-level tools do not already express.",
            when_not_to_use="Prefer animate_camera for camera moves. Do not invent property names the compiler cannot bind.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["targetId exists.", "endFrame >= startFrame when both are set."],
            dependencies=[],
            behavior="Record a property animation on the specification and return its animationId.",
            errors={MISSING_TARGET: "Create the target first.", INVALID_RANGE: "endFrame must be >= startFrame."},
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits="Counts toward the object/animation envelope of the scene.",
            reversible=True,
            defaults="easing defaults to ease_in_out.",
            parameters=[
                Param("targetId", "string", True, "Existing object, typography, environment or camera-move id."),
                Param("property", "string", True, "Property to animate (x, y, opacity, rotation, scale, width, ...)."),
                Param("from", "number", False, "Start value."),
                Param("to", "number", False, "End value."),
                Param("startFrame", "integer", False, "Start frame."),
                Param("endFrame", "integer", False, "End frame."),
                Param("easing", "string", False, "Curve.", allowed=list(EASING), default="ease_in_out"),
                Param("animationId", "string", False, "Stable id."),
            ],
            examples=[{
                "tool": "animate_property",
                "arguments": {"targetId": "media_1", "property": "opacity", "from": 0, "to": 1, "startFrame": 0, "endFrame": 20, "easing": "ease_out"},
            }],
            apply_fn=_animate_property,
        ),
        Tool(
            name="apply_effect",
            tier=1,
            purpose="Apply a deterministic effect (spotlight, grain, shake, damp, hold) with validated parameters. Spotlight keys on different targets must remain at least 0.25 s apart.",
            when_to_use="When the blueprint calls for a spotlight, grain, camera shake, damp or a deliberate hold effect.",
            when_not_to_use="Do not stack two spotlights on different targets closer than 0.25 s. A camera hold should use animate_camera with easing='hold', not a second shot key.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["An environment exists."],
            dependencies=["create_environment"],
            behavior="Record the effect on the specification and return its effectId. The compiler emits film.focus/shot/shake/damp or a grain item, honoring the 0.25 s spotlight rule.",
            errors={PRECONDITION_FAILED: "Call create_environment first.", UNSUPPORTED_VALUE: f"Use one of {list(EFFECT_KINDS)}."},
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_OBJECTS} effect/objects per scene.",
            reversible=True,
            defaults="params default to empty.",
            parameters=[
                Param("kind", "string", True, "Effect kind.", allowed=list(EFFECT_KINDS)),
                Param("targetId", "string", False, "Optional object to attach the effect to."),
                Param("startFrame", "integer", False, "Start frame."),
                Param("endFrame", "integer", False, "End frame."),
                Param("params", "object", False, "Kind-specific parameters (radius, strength, amplitude)."),
                Param("environmentId", "string", False, "Target environment."),
                Param("effectId", "string", False, "Stable id."),
            ],
            examples=[{
                "tool": "apply_effect",
                "arguments": {"kind": "spotlight", "targetId": "media_1", "startFrame": 24, "params": {"strength": 0.55}},
            }],
            apply_fn=_apply_effect,
        ),
        Tool(
            name="layout_group",
            tier=1,
            purpose="Group existing objects into a composition (free, row, column, stack, cluster) without freezing them into a template.",
            when_to_use="When several placed objects should move or be composed as a unit.",
            when_not_to_use="Do not use it to create objects; place them first.",
            prohibited=_COMMON_PROHIBITED,
            preconditions=["Every memberId exists."],
            dependencies=[],
            behavior="Record a group and return its groupId. Layout names are composition hints, not fixed templates.",
            errors={MISSING_TARGET: "Place each member first."},
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH,
            resource_limits=f"At most {MAX_OBJECTS} objects per scene.",
            reversible=True,
            defaults="layout defaults to free.",
            parameters=[
                Param("memberIds", "array", True, "Existing object or typography ids."),
                Param("layout", "string", False, "free | row | column | stack | cluster.", default="free"),
                Param("position", "object", False, "Group origin {x, y}."),
                Param("groupId", "string", False, "Stable id."),
            ],
            examples=[{"tool": "layout_group", "arguments": {"memberIds": ["media_1", "type_1"], "layout": "cluster", "position": {"x": 0, "y": 0}}}],
            apply_fn=_layout_group,
        ),
        Tool(
            name="use_component",
            tier=3,
            purpose="Place an already registered custom visual component (for example a validated ticker) through a deterministic call. This does not accept raw source.",
            when_to_use="When a previously registered extension (validated, versioned, documented) should appear in this scene.",
            when_not_to_use="Do not pass raw Python. Do not use this as the first-time authoring path — that is the extension registrar after lint, sandbox and visual tests.",
            prohibited=_COMMON_PROHIBITED + " Passing raw code is an authorization error.",
            preconditions=["The component name and version are registered.", "An environment exists."],
            dependencies=["create_environment", "register_component (trusted extension path)"],
            behavior="Reject any raw code argument. Record a use of the registered component on the specification and return its objectId. The compiler instantiates the registered component.",
            errors={
                AUTHORIZATION: "Register the component through the trusted extension path first.",
                PRECONDITION_FAILED: "Call create_environment first.",
            },
            side_effects=_COMMON_SIDE,
            authorization=_COMMON_AUTH + " Registration of new code is a separate authorized path.",
            resource_limits=f"At most {MAX_OBJECTS} objects per scene.",
            reversible=True,
            defaults="componentArguments default to empty.",
            parameters=[
                Param("component", "string", True, "Registered component name."),
                Param("code", "string", False, "Forbidden. Raw source is not accepted here; register the component through the trusted extension path first."),
                Param("componentVersion", "string", False, "Registered version. Defaults to the latest registered version."),
                Param("componentArguments", "object", False, "Structured arguments declared by the component interface."),
                Param("position", "object", False, "World position {x, y}."),
                Param("environmentId", "string", False, "Target environment."),
                Param("objectId", "string", False, "Stable id."),
            ],
            examples=[{
                "tool": "use_component",
                "arguments": {"component": "ticker", "componentVersion": "1.0+abc", "componentArguments": {"symbol": "TICKER"}, "position": {"x": 0, "y": 200}},
            }],
            apply_fn=_use_component,
        ),
    ]
    return [_bind(t) for t in tools]
