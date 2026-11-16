"""Turn a Motion Engineer JSON payload into a compiled scene or a structured limitation."""
from __future__ import annotations

import json
from typing import Any

from clips_worker.motion_studio.directors.documentary.contracts import extract_limitation
from clips_worker.motion_studio.tools.compiler import CompileError, compile_spec
from clips_worker.motion_studio.tools.registry import apply_calls
from clips_worker.motion_studio.tools.spec import attach_scene_timing, clamp_spec_timing, new_spec
from clips_worker.motion_studio.tools.validate import validate_spec


def _prepare_engineer_tools(calls: list[dict[str, Any]], *, approved_world: list[dict],
                            duration_s: float | None, fps: int,
                            world_id: str | None = None,
                            world_brief: str | None = None) -> tuple[list[dict], list[dict], list[dict]]:
    """Mechanical correction at the tool boundary; never change creative choices.

    Designer-owned background primitives belong to create_environment.backdrop.elements.
    They are not individually addressable scene objects for layout_group/animate_property.
    Return precise errors when the engineer asks for an unsupported operation.
    """
    prepared: list[dict] = []
    changes: list[dict] = []
    problems: list[dict] = []
    original = [dict(row) if isinstance(row, dict) else row for row in calls]
    world_by_id = {e["id"]: e for e in approved_world if isinstance(e, dict) and e.get("id")}
    creators = [(i, row) for i, row in enumerate(original)
                if isinstance(row, dict) and row.get("tool") == "create_environment"]
    if approved_world and not creators:
        # The Designer has already authored the world. It is valid to construct
        # that approved environment deterministically even when the Engineer
        # omitted the creation call during a repair. We do not invent geometry.
        referenced = set()
        for row in original:
            if not isinstance(row, dict):
                continue
            args = row.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except (ValueError, TypeError):
                    continue
            if isinstance(args, dict) and args.get("environmentId"):
                referenced.add(args["environmentId"])
        target = world_id or (next(iter(referenced)) if len(referenced) == 1 else None)
        if not target or (referenced and referenced != {target}):
            problems.append({"code": "MISSING_ENVIRONMENT_TOOL",
                             "message": "The Designer-approved world cannot be assigned to an unambiguous "
                                        f"environmentId (expected {world_id!r}, referenced {sorted(referenced)}). "
                                        "Create the environment explicitly first."})
            return [], changes, problems
        original.insert(0, {
            "tool": "create_environment",
            "arguments": {
                "environmentId": target,
                "brief": world_brief or "Production Designer-authored drawable environment",
                "size": {"width": 3840, "height": 2160},
                "backdrop": {"kind": "geometry", "elements": list(approved_world)},
            },
        })
        changes.append({"kind": "insert_approved_environment", "worldId": target,
                        "elementIds": [e.get("id") for e in approved_world if isinstance(e, dict)],
                        "source": "Production Designer approvedWorldElements",
                        "reason": "Real world geometry is provided upstream; a missing Engineer "
                                  "tool call must not erase it or trigger repetitive paid repair."})
        creators = [(0, original[0])]
    if len(creators) == 1 and creators[0][0] != 0:
        i, env_call = creators[0]
        original = [env_call] + original[:i] + original[i + 1:]
        changes.append({"kind": "order", "tool": "create_environment", "fromIndex": i, "toIndex": 0,
                        "reason": "environment must exist before scene objects"})
    if approved_world and len(creators) > 1:
        problems.append({"code": "AMBIGUOUS_WORLD_TARGET",
                         "message": "Multiple create_environment calls require explicit approved-world allocation; "
                                    "cannot infer which environment owns the Designer's elements."})
        return [], changes, problems

    # Relevant live compiler API is frame-based for animate_property even when
    # narration-facing instructions prefer seconds.
    for i, raw in enumerate(original):
        if not isinstance(raw, dict):
            prepared.append(raw)
            continue
        row = dict(raw)
        args = row.get("arguments")
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except (ValueError, TypeError):
                prepared.append(row)
                continue
        if not isinstance(args, dict):
            prepared.append(row)
            continue
        args = dict(args)
        tool = row.get("tool")
        if tool == "create_environment" and approved_world:
            backdrop = dict(args.get("backdrop") or {})
            existing = backdrop.get("elements") or []
            if not isinstance(existing, list):
                problems.append({"code": "INVALID_WORLD_GEOMETRY",
                                 "message": "create_environment.backdrop.elements must be an array."})
                continue
            # The Production Designer owns these exact geometry definitions.
            # Engineer-written copies may use a different shape vocabulary
            # ("environment" vs "line"/"rrect") or omit metadata. Treat those
            # as references to the approved world, not as new geometry.
            # Preserve extra Engineer-created shapes; never silently accept
            # altered Designer-owned shapes or lose their exact source values.
            claimed = {e.get("id"): e for e in existing if isinstance(e, dict) and e.get("id")}
            overrides = []
            for eid, element in world_by_id.items():
                if eid in claimed and claimed[eid] != element:
                    keys = sorted(k for k in set(claimed[eid]) | set(element)
                                  if claimed[eid].get(k) != element.get(k))
                    overrides.append({"id": eid, "differingFields": keys,
                                      "engineerKind": claimed[eid].get("kind"),
                                      "approvedKind": element.get("kind")})
            missing = [eid for eid in world_by_id if eid not in claimed]
            # Engineer may return ID-less copies of the complete approved world.
            # Those are not creative extras: keeping them duplicates artwork and
            # distorts both geometry counts and rendering. Compare every field
            # except the ID; preserve genuinely new Engineer artwork.
            approved_without_ids = [
                {k: v for k, v in element.items() if k != "id"}
                for element in world_by_id.values()
            ]
            extras = []
            dropped_copies = 0
            for element in existing:
                if isinstance(element, dict) and element.get("id") in world_by_id:
                    continue
                if (isinstance(element, dict) and not element.get("id") and
                        {k: v for k, v in element.items() if k != "id"}
                        in approved_without_ids):
                    dropped_copies += 1
                    continue
                extras.append(element)
            if overrides or missing or dropped_copies:
                backdrop["elements"] = list(world_by_id.values()) + extras
                args["backdrop"] = backdrop
                changes.append({"kind": "bind_approved_world", "tool": tool,
                                "source": "production_designer.environmentElements",
                                "restoredIds": missing, "overridden": overrides,
                                "droppedIdlessCopies": dropped_copies,
                                "reason": "Designer shapes are authoritative; matching "
                                          "ID-less copies must not render twice"})
        if tool == "animate_property":
            for start, dest in (("startS", "startFrame"), ("endS", "endFrame")):
                if start not in args:
                    continue
                if dest in args:
                    problems.append({"code": "AMBIGUOUS_ANIMATION_TIMING",
                                     "message": f"animate_property supplied both {start} and {dest}; use one time unit."})
                    continue
                try:
                    seconds = float(args[start])
                    frame = round(seconds * fps)
                    if seconds < 0 or (duration_s is not None and seconds > duration_s + 0.001):
                        raise ValueError("outside scene")
                except (TypeError, ValueError):
                    problems.append({"code": "INVALID_ANIMATION_TIME",
                                     "message": f"animate_property.{start} must be a finite, nonnegative "
                                                "second value within scene duration."})
                    continue
                args[dest] = frame
                del args[start]
                changes.append({"kind": "timing", "tool": tool, "callIndex": i,
                                "from": start, "to": dest, "frame": frame})
        if tool == "layout_group":
            referenced = set(args.get("memberIds") or [])
            backdrop_ids = sorted(referenced & set(world_by_id))
            if backdrop_ids:
                problems.append({"code": "WORLD_GEOMETRY_NOT_GROUPABLE",
                                 "message": "layout_group can only reference objects created with place_media, "
                                            "place_primitive, create_graphic, animate_text or layout_group. "
                                            "The following are backdrop geometry IDs, not scene objects: " +
                                            ", ".join(backdrop_ids) +
                                            ". Keep these in create_environment.backdrop.elements; "
                                            "to animate/group them, author corresponding supported scene objects "
                                            "using their exact IDs first."})
        row["arguments"] = args
        prepared.append(row)
    return prepared, changes, problems


def _enforce_approved_memberships(spec: dict, composition: list[dict]) -> list[dict]:
    """Add an explicitly approved member to an existing group, never invent a group."""
    changes = []
    objects = spec.get("objects") or {}
    typography = spec.get("typography") or {}
    for element in composition:
        if not isinstance(element, dict):
            continue
        oid, gid = element.get("id"), element.get("groupId")
        if not oid or not gid or oid not in objects and oid not in typography:
            continue
        group = objects.get(gid)
        if not group or group.get("kind") != "group":
            continue
        members = group.setdefault("memberIds", [])
        if oid not in members:
            members.append(oid)
            changes.append({"kind": "restore_approved_group_member",
                            "groupId": gid, "memberId": oid,
                            "reason": "explicitly specified in Designer compositionElements"})
    return changes


def compile_agent_output(
    out: dict[str, Any] | None,
    *,
    scene_id: str,
    catalog_ids: list[str] | None = None,
    duration_s: float | None = None,
    fps: int = 30,
    allow_custom_code: bool = True,
    anchors: dict | None = None,
    camera_intent: str | None = None,
    required_effects: list[str] | None = None,
    composition_elements: list[dict] | None = None,
    planned_camera_shots: list[dict] | None = None,
    world_elements: list[dict] | None = None,
    world_id: str | None = None,
    world_brief: str | None = None,
    transition_intent: str | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    """Prefer tool calls / a scene spec. Custom code is Tier 3 only. Limitations pass through."""
    payload = out or {}
    payload = _coerce_structured_fields(payload)
    lim = extract_limitation(payload)
    if lim and not payload.get("tools") and not payload.get("spec") and not payload.get("code"):
        return {"ok": False, "limitation": lim, "tier": None, "code": None, "spec": None, "errors": []}

    if payload.get("spec") or payload.get("tools"):
        spec = payload.get("spec") or new_spec(scene_id, fps=fps, duration_s=duration_s, catalog_ids=catalog_ids)
        attach_scene_timing(spec, duration_s=duration_s, fps=fps, anchors=anchors)
        spec["cameraIntent"] = camera_intent
        spec["cameraRequired"] = camera_intent == "travel"
        spec["requiredEffects"] = list(required_effects or [])
        spec["compositionElements"] = list(composition_elements or [])
        spec["plannedCameraShots"] = list(planned_camera_shots or [])
        spec["requiredWorldElements"] = list(world_elements or [])
        spec["approvedTransitionIntent"] = transition_intent
        if project_id:
            spec["projectId"] = project_id
        if payload.get("tools"):
            prepared, adjustments, early_errors = _prepare_engineer_tools(
                payload["tools"], approved_world=list(world_elements or []),
                duration_s=duration_s, fps=fps,
                world_id=world_id, world_brief=world_brief)
            if early_errors:
                return {"ok": False, "limitation": None, "tier": 1, "code": None, "spec": spec,
                        "errors": early_errors, "toolAdjustments": adjustments}
            spec, results = apply_calls(spec, prepared)
            errors = [e for r in results for e in r.errors]
            if errors:
                return {"ok": False, "limitation": None, "tier": 1, "code": None, "spec": spec,
                        "errors": errors, "results": [r.as_dict() for r in results],
                        "toolAdjustments": adjustments}
        membership_changes = _enforce_approved_memberships(
            spec, list(composition_elements or []))
        if payload.get("tools"):
            adjustments.extend(membership_changes)
        clamp_spec_timing(spec)
        problems = validate_spec(spec, catalog_ids=catalog_ids)
        if problems:
            return {"ok": False, "limitation": None, "tier": 1, "code": None, "spec": spec, "errors": problems}
        try:
            code = compile_spec(spec, catalog_ids=catalog_ids)
        except CompileError as exc:
            return {"ok": False, "limitation": None, "tier": 1, "code": None, "spec": spec, "errors": exc.problems}
        return {
            "ok": True,
            "limitation": None,
            "tier": 1,
            "code": code,
            "spec": spec,
            "errors": [],
            "dependencies": payload.get("dependencies") or _dependencies(spec),
            "toolAdjustments": adjustments if payload.get("tools") else [],
        }

    if payload.get("code"):
        if composition_elements or planned_camera_shots or world_elements:
            return {"ok": False, "limitation": None, "tier": 3, "code": None, "spec": None,
                    "errors": [{"code": "UNVERIFIABLE_CUSTOM_COMPOSITION",
                                "message": "Tier-3 freeform source cannot prove the named composition elements, "
                                           "drawable world shapes or camera shot endpoints. Use registered tools "
                                           "and a registered custom_component where needed; do not substitute a generic scene."}]}
        # The custom-code route cannot silently substitute a static scene for a planned camera journey.
        if camera_intent == "travel" and not any(token in str(payload["code"]) for token in ("film.cam(", "film.shot(")):
            return {"ok": False, "limitation": None, "tier": 3, "code": None, "spec": None,
                    "errors": [{"code": "CAMERA_INTENT_MISSING", "message": "custom code lacks the planned camera journey"}]}
        if not allow_custom_code:
            return {
                "ok": False,
                "limitation": extract_limitation({"limitation": {
                    "reason": "Custom code is disabled; implement the blueprint with registered tools.",
                    "unblock": "Express the design as tool calls, or enable the Tier 3 extension path.",
                }}),
                "tier": 3,
                "code": None,
                "spec": None,
                "errors": [{"code": "CUSTOM_CODE_DISABLED", "message": "custom Python is not enabled."}],
            }
        return {
            "ok": True,
            "limitation": None,
            "tier": 3,
            "code": str(payload["code"]),
            "spec": None,
            "errors": [],
            "reason": payload.get("reason") or "Registered tools could not express the approved design.",
            "dependencies": payload.get("dependencies") or [],
        }

    return {
        "ok": False,
        "limitation": None,
        "tier": None,
        "code": None,
        "spec": None,
        "errors": [{"code": "EMPTY_OUTPUT", "message": "Motion Engineer returned neither tools, a scene spec, custom code, nor a limitation."}],
    }


def _dependencies(spec: dict) -> list[str]:
    deps = []
    for obj in (spec.get("objects") or {}).values():
        if obj.get("assetId"):
            deps.append(obj["assetId"])
        if obj.get("component"):
            deps.append(f"component:{obj['component']}")
    return sorted(set(deps))


def _coerce_structured_fields(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept tool arguments / spec as a JSON object or as a JSON string (strict schema)."""
    out = dict(payload)
    tools = out.get("tools")
    if isinstance(tools, list):
        coerced = []
        for item in tools:
            if not isinstance(item, dict):
                coerced.append(item)
                continue
            row = dict(item)
            args = row.get("arguments")
            if isinstance(args, str):
                try:
                    row["arguments"] = json.loads(args) if args.strip() else {}
                except ValueError:
                    row["arguments"] = {"_unparsed": args}
            elif args is None:
                row["arguments"] = {}
            coerced.append(row)
        out["tools"] = coerced
    spec = out.get("spec")
    if isinstance(spec, str):
        try:
            out["spec"] = json.loads(spec) if spec.strip() else None
        except ValueError:
            pass
    return out
