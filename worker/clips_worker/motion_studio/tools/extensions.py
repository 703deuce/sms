"""Tier 3: controlled custom-component registration and reuse."""
from __future__ import annotations

import hashlib
from typing import Any

from clips_worker.motion_studio.sandbox.policy import check_code, lint_scene

# In-process registry. Persistent storage of approved components is an authorized
# deterministic service and is not performed here.
_COMPONENTS: dict[str, dict[str, Any]] = {}


def register_component(
    name: str,
    code: str,
    *,
    interface: dict[str, Any] | None = None,
    visual_ok: bool = False,
) -> dict[str, Any]:
    """Register a custom component after lint + policy checks.

    visual_ok must be True only after runtime/visual tests have passed (the
    caller, not this function, runs those tests — this host may lack skia).
    """
    problems = lint_scene(code)
    if problems:
        return {"ok": False, "errors": [{"code": "LINT_FAILED", "message": p} for p in problems]}
    try:
        check_code(code)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "errors": [{"code": "POLICY_VIOLATION", "message": str(exc)}]}
    if not visual_ok:
        return {
            "ok": False,
            "errors": [{
                "code": "VISUAL_TESTS_REQUIRED",
                "message": "Refuse to register until runtime and visual tests pass (set visual_ok=True after they do).",
            }],
        }
    version = "1.0+" + hashlib.sha256(code.encode()).hexdigest()[:8]
    rec = {
        "name": name,
        "version": version,
        "code": code,
        "interface": interface or {},
    }
    _COMPONENTS[f"{name}@{version}"] = rec
    _COMPONENTS[name] = rec  # latest
    return {"ok": True, "name": name, "version": version, "interface": rec["interface"]}


def use_component(name: str, version: str | None = None) -> dict[str, Any] | None:
    key = f"{name}@{version}" if version else name
    return _COMPONENTS.get(key)


def registered_names() -> list[str]:
    return sorted({rec["name"] for rec in _COMPONENTS.values() if isinstance(rec, dict) and "name" in rec})
