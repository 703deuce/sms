"""Clip aiMeta merge helpers (no DB imports)."""


def finalize_clip_ai_meta(
    pick: dict,
    reframe_meta: dict,
    crop_method: str,
    resolved_layout: str,
) -> dict:
    """Merge picker + reframe metadata (incl. person count for results strip)."""
    out = {**(pick.get("aiMeta") or {}), **reframe_meta}
    if pick.get("hook") and not out.get("hook"):
        out["hook"] = pick.get("hook")
    out["cropMethod"] = crop_method
    out["layoutResolved"] = resolved_layout
    shadow = out.get("layoutRouteShadow")
    if isinstance(shadow, dict):
        n_persons = shadow.get("nPersons")
        if isinstance(n_persons, int) and n_persons > 0:
            out["nPersons"] = n_persons
    return out
