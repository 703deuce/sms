"""EF-24/29: edits.bgRemoval normalize + gate + refine maths (mirror: new-app/lib/clips/editor/bg-removal.ts)."""
from __future__ import annotations

import os
import re

BG_TYPES = ("blur", "color", "image", "none")
QUALITIES = ("standard", "detail")
_HEX = re.compile(r"^[0-9a-fA-F]{6}$")
BLUR_UNIT = 0.04


def _num(v, lo: float, hi: float, d: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return d
    if x != x:
        return d
    return max(lo, min(hi, x))


def normalize_bg_removal(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    bg = raw.get("background") if isinstance(raw.get("background"), dict) else {}
    t = bg.get("type") if bg.get("type") in BG_TYPES else "blur"
    out_bg: dict = {"type": t}
    if t == "blur":
        out_bg["amount"] = round(_num(bg.get("amount"), 0, 100, 50))
    if t == "color":
        c = str(bg.get("color") or "").lstrip("#")
        out_bg["color"] = c.lower() if _HEX.match(c) else "000000"
    if t == "image":
        u = bg.get("uploadId")
        if isinstance(u, str) and 0 < len(u) <= 64:
            out_bg["uploadId"] = u
        else:
            out_bg = {"type": "blur", "amount": 50}
    ref = raw.get("refine") if isinstance(raw.get("refine"), dict) else {}
    out = {
        "enabled": raw.get("enabled") is True,
        "quality": raw.get("quality") if raw.get("quality") in QUALITIES else "standard",
        "refine": {
            "feather": round(_num(ref.get("feather"), 0, 100, 10)),
            "choke": round(_num(ref.get("choke"), -100, 100, 0)),
        },
        "background": out_bg,
    }
    g = raw.get("generationId")
    if isinstance(g, str) and 0 < len(g) <= 64:
        out["generationId"] = g
    return out


def bg_matte_enabled() -> bool:
    # Explicit opt-out remains available. Requests still pass the existing GPU budget guard.\n    return os.environ.get("BG_MATTE_ENABLED", "1").strip().lower() in ("1", "true", "yes", "on")


def bg_matte_provider() -> str:
    p = os.environ.get("BG_MATTE_PROVIDER", "auto").strip().lower()
    return p if p in ("auto", "modal", "cpu") else "auto"


def bg_removal_allowed(edits: dict) -> bool:
    from clips_worker.main_fx import main_key_allowed

    return (
        main_key_allowed(edits)
        and not edits.get("stabilize")
    )


def bg_removal_active(edits: dict) -> dict | None:
    b = normalize_bg_removal(edits.get("bgRemoval"))
    if not b or not b["enabled"] or b["background"]["type"] == "none":
        return None
    if not bg_matte_enabled() or not bg_removal_allowed(edits):
        return None
    return b


def refine_params(feather: float, choke: float, short_side: int) -> tuple[float, float, float]:
    s = float(short_side)
    sigma = max(feather / 100.0 * 0.010 * s, abs(choke) / 100.0 * 0.006 * s)
    t = choke / 100.0 * 0.5
    return sigma, max(0.0, t), min(1.0, 1.0 + t)


def refine_alpha(a: float, feather: float, choke: float) -> float:
    _, lo, hi = refine_params(feather, choke, 1080)
    return max(0.0, min(1.0, (a - lo) / max(1e-6, hi - lo)))
