"""Turn a Motion Engineer JSON payload into a compiled scene or a structured limitation."""
from __future__ import annotations

from typing import Any

from clips_worker.motion_studio.directors.documentary.contracts import extract_limitation
from clips_worker.motion_studio.tools.compiler import CompileError, compile_spec
from clips_worker.motion_studio.tools.registry import apply_calls
from clips_worker.motion_studio.tools.spec import new_spec
from clips_worker.motion_studio.tools.validate import validate_spec


def compile_agent_output(
    out: dict[str, Any] | None,
    *,
    scene_id: str,
    catalog_ids: list[str] | None = None,
    duration_s: float | None = None,
    fps: int = 30,
    allow_custom_code: bool = True,
) -> dict[str, Any]:
    """Prefer tool calls / a scene spec. Custom code is Tier 3 only. Limitations pass through."""
    payload = out or {}
    lim = extract_limitation(payload)
    if lim and not payload.get("tools") and not payload.get("spec") and not payload.get("code"):
        return {"ok": False, "limitation": lim, "tier": None, "code": None, "spec": None, "errors": []}

    if payload.get("spec") or payload.get("tools"):
        spec = payload.get("spec") or new_spec(scene_id, fps=fps, duration_s=duration_s, catalog_ids=catalog_ids)
        if payload.get("tools"):
            spec, results = apply_calls(spec, payload["tools"])
            errors = [e for r in results for e in r.errors]
            if errors:
                return {"ok": False, "limitation": None, "tier": 1, "code": None, "spec": spec, "errors": errors, "results": [r.as_dict() for r in results]}
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
        }

    if payload.get("code"):
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
