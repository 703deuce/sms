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


def persist_project_component(project: dict, name: str, version: str, scratch: str) -> dict:
    """Persist visually approved component with project-specific content address."""
    import json
    from pathlib import Path
    from clips_worker.storage import upload_file
    from clips_worker.motion_studio.pipeline.music_source import work_key
    if not name.startswith(str(project["id"]) + "__"):
        raise ValueError("component not owned by active project")
    record = export_approved_component(name, version)
    if record is None:
        raise ValueError("component must be approved")
    digest = record["codeSha256"]
    key = f"{work_key(project)}/components/{digest}.json"
    local = Path(scratch) / f"component_{digest}.json"
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_text(json.dumps(record, sort_keys=True), encoding="utf-8")
    upload_file(key, local, "application/json")
    return {"name": name, "version": version, "storageKey": key, "codeSha256": digest}


def hydrate_project_components(project: dict, rows: list[dict], scratch: str) -> list[dict]:
    """Trusted db.scenes rows only: hydrate strictly project-owned approved components."""
    import json
    from pathlib import Path
    from clips_worker.storage import download_object
    from clips_worker.motion_studio.pipeline.music_source import work_key
    prefix = f"{work_key(project)}/components/"
    available, seen = [], set()
    for scene in rows:
        ref = (scene.get("qa") or {}).get("approvedComponent") or {}
        key = ref.get("storageKey")
        if not isinstance(key, str):
            continue
        if not key.startswith(prefix) or not key.endswith(".json"):
            raise ValueError("component key escapes the project namespace")
        if key in seen:
            continue
        seen.add(key)
        local = Path(scratch) / f"approved_{ref.get('codeSha256')}.json"
        local.parent.mkdir(parents=True, exist_ok=True)
        download_object(key, local)
        record = json.loads(local.read_text(encoding="utf-8"))
        if (not record.get("name", "").startswith(str(project["id"]) + "__") or
                record.get("codeSha256") != ref.get("codeSha256")):
            raise ValueError("component metadata does not match project")
        result = hydrate_approved_component(record)
        if not result.get("ok"):
            raise ValueError("component fails hash, approval or sandbox validation")
        available.append({"name": record["name"], "version": record["version"],
                          "interface": record.get("interface") or {}})
    return available
