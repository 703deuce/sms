"""Light auto-edit for found clips: trim + 9:16 + captions only (Rick a)."""


def light_auto_edit(edits: dict, settings: dict) -> dict:
    out = dict(edits)
    if not settings.get("autoZoom"):
        zoom = dict(out.get("zoom") or {})
        zoom["enabled"] = False
        out["zoom"] = zoom
    out.pop("silenceTrim", None)
    out.pop("hookOverlay", None)
    return out
