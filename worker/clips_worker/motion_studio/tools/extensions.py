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


def export_approved_component(name: str, version: str | None = None) -> dict[str, Any] | None:
    """Trusted storage service may persist this content-addressed approved record."""
    rec = use_component(name, version)
    if not rec:
        return None
    return {
        "name": rec["name"], "version": rec["version"], "code": rec["code"],
        "interface": rec["interface"],
        "codeSha256": hashlib.sha256(rec["code"].encode()).hexdigest(),
        "visualApproved": True,
    }


def hydrate_approved_component(record: dict[str, Any]) -> dict[str, Any]:
    """Load a previously verified component from authorized persistent storage.

    Call only after authenticating the storage object and project ownership.
    Refuse tampered or incomplete objects; re-run policy validation on every load.
    """
    if not isinstance(record, dict) or record.get("visualApproved") is not True:
        return {"ok": False, "errors": [{"code": "UNAPPROVED_COMPONENT", "message": "component lacks stored approval"}]}
    name, code, version = record.get("name"), record.get("code"), record.get("version")
    if not isinstance(name, str) or not isinstance(code, str) or not isinstance(version, str):
        return {"ok": False, "errors": [{"code": "INVALID_COMPONENT", "message": "component metadata incomplete"}]}
    digest = hashlib.sha256(code.encode()).hexdigest()
    if digest != record.get("codeSha256") or version != "1.0+" + digest[:8]:
        return {"ok": False, "errors": [{"code": "COMPONENT_HASH_MISMATCH", "message": "stored code differs from approved version"}]}
    return register_component(name, code, interface=record.get("interface") or {}, visual_ok=True)
