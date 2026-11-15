"""Element-level scene structure: preserved source for targeted edits.

The compiled scene spec (and any stored qa.spec) is the source of truth for
text objects, graphics, media assignments, animations and soundtrack cues.
Patches mutate that spec only; they do not ask a model to rewrite the scene
or write to the live database themselves.
"""
from __future__ import annotations

from typing import Any


def elements_from_spec(spec: dict | None) -> list[dict]:
    """Flatten a versioned scene spec into an editable element list."""
    if not isinstance(spec, dict):
        return []
    out: list[dict] = []
    seen: set[str] = set()

    def add(eid: str, kind: str, **fields: Any) -> None:
        if not eid or eid in seen:
            return
        seen.add(eid)
        out.append({"id": eid, "kind": kind, **fields})

    env = spec.get("environment") or {}
    if env:
        add(str(env.get("id") or "environment"), "environment",
            name=env.get("name"), brief=env.get("brief") or env.get("description"))
    for item in spec.get("media") or spec.get("placements") or []:
        if not isinstance(item, dict):
            continue
        add(str(item.get("id") or item.get("assetId") or item.get("mediaId") or f"media_{len(out)}"),
            "media", assetId=item.get("assetId") or item.get("mediaId"),
            role=item.get("role"), inS=item.get("inS"), outS=item.get("outS"))
    for item in spec.get("graphics") or spec.get("objects") or []:
        if not isinstance(item, dict):
            continue
        add(str(item.get("id") or item.get("name") or f"graphic_{len(out)}"),
            "graphic", name=item.get("name") or item.get("type"),
            type=item.get("type") or item.get("kind"),
            params=item.get("params") or item.get("props") or {})
    for item in spec.get("text") or spec.get("titles") or spec.get("type") or []:
        if not isinstance(item, dict):
            continue
        add(str(item.get("id") or f"text_{len(out)}"), "text",
            text=item.get("text") or item.get("content") or item.get("copy"),
            role=item.get("role") or item.get("kind"))
    for item in spec.get("animations") or spec.get("motion") or []:
        if not isinstance(item, dict):
            continue
        add(str(item.get("id") or item.get("motionId") or f"anim_{len(out)}"),
            "animation", target=item.get("target") or item.get("elementId"),
            kind=item.get("kind") or item.get("easing"))
    for item in spec.get("audio") or spec.get("cues") or []:
        if not isinstance(item, dict):
            continue
        add(str(item.get("id") or f"audio_{len(out)}"), "audio",
            kind=item.get("kind") or item.get("cue") or "cue",
            at=item.get("at") or item.get("t") or item.get("start"))
    cam = spec.get("camera") or {}
    if cam:
        add(str(cam.get("id") or "camera"), "camera",
            route=cam.get("route"), personality=cam.get("personality"))
    return out


def apply_element_patch(spec: dict, patch: dict) -> dict:
    """Return a new spec with one element's fields updated. Planning only."""
    updated = dict(spec or {})
    eid = str(patch.get("id") or patch.get("elementId") or "")
    if not eid:
        raise ValueError("element patch is missing id")
    fields = {k: v for k, v in patch.items() if k not in ("id", "elementId")}

    def patch_list(key: str) -> bool:
        rows = list(updated.get(key) or [])
        found = False
        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            rid = str(row.get("id") or row.get("assetId") or row.get("mediaId") or row.get("motionId") or row.get("name") or "")
            if rid == eid:
                rows[i] = {**row, **fields}
                found = True
                break
        if found:
            updated[key] = rows
        return found

    for key in ("media", "placements", "graphics", "objects", "text", "titles", "type", "animations", "motion", "audio", "cues"):
        if patch_list(key):
            return updated
    if eid in ("environment", str((updated.get("environment") or {}).get("id") or "")):
        updated["environment"] = {**(updated.get("environment") or {}), **fields}
        return updated
    if eid in ("camera", str((updated.get("camera") or {}).get("id") or "")):
        updated["camera"] = {**(updated.get("camera") or {}), **fields}
        return updated
    # Unknown id: record the patch so a later compiler/reviewer can see it.
    extras = list(updated.get("elementPatches") or [])
    extras.append({"id": eid, **fields})
    updated["elementPatches"] = extras
    return updated


def apply_element_patches(spec: dict | None, patches: list[dict] | None) -> dict:
    out = dict(spec or {})
    for patch in patches or []:
        if isinstance(patch, dict):
            out = apply_element_patch(out, patch)
    return out
