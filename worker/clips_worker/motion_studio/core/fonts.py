"""Licence-clean font roles for the vendored engine (RE-1 / ST-ENG-002, SEC-2).

The upstream engine prefers proprietary system faces (Baskerville, DIN, Avenir, Helvetica, Arial, Impact, ...).
Motion Studio replaces its FONT_ROLES with open-licence families shipped in the worker image (worker/v3/fonts/t6,
fonts-noto-core). `apply()` mutates engine.FONT_ROLES in place, so every resolve_typeface() call sees it."""
from __future__ import annotations

# family -> licence (only these may be resolved for product renders)
FONT_LICENCES = {
    "Libre Baskerville": "OFL-1.1", "Lora": "OFL-1.1", "Merriweather": "OFL-1.1", "Noto Serif": "OFL-1.1",
    "Courier Prime": "OFL-1.1", "IBM Plex Mono": "OFL-1.1", "Space Mono": "OFL-1.1", "JetBrains Mono": "OFL-1.1",
    "Noto Sans Mono": "OFL-1.1",
    "Homemade Apple": "Apache-2.0", "Caveat": "OFL-1.1", "Kalam": "OFL-1.1", "Permanent Marker": "Apache-2.0",
    "Oswald": "OFL-1.1", "Bebas Neue": "OFL-1.1", "Roboto Condensed": "Apache-2.0", "Fira Sans Condensed": "OFL-1.1",
    "Barlow Condensed": "OFL-1.1",
    "Montserrat": "OFL-1.1", "Inter": "OFL-1.1", "Work Sans": "OFL-1.1", "Noto Sans": "OFL-1.1",
    "DejaVu Sans": "Bitstream-Vera", "DejaVu Serif": "Bitstream-Vera", "DejaVu Sans Mono": "Bitstream-Vera",
}

OFL_ROLES = {
    "serif": [("Libre Baskerville", 400), ("Lora", 400), ("Merriweather", 400), ("Noto Serif", 400), ("DejaVu Serif", 400)],
    "mono": [("Courier Prime", 700), ("IBM Plex Mono", 700), ("Space Mono", 700), ("JetBrains Mono", 700), ("Noto Sans Mono", 700),
             ("DejaVu Sans Mono", 700)],
    "hand": [("Homemade Apple", 400), ("Caveat", 400), ("Kalam", 400), ("Permanent Marker", 400)],
    "cond": [("Oswald", 700), ("Bebas Neue", 400), ("Roboto Condensed", 700), ("Fira Sans Condensed", 700), ("Barlow Condensed", 700),
             ("Noto Sans", 700)],
    "label": [("Montserrat", 800), ("Inter", 700), ("Work Sans", 700), ("Noto Sans", 700), ("DejaVu Sans", 700)],
    "labelm": [("Montserrat", 600), ("Inter", 500), ("Work Sans", 500), ("Noto Sans", 400), ("DejaVu Sans", 400)],
}


def apply() -> None:
    from clips_worker.motion_studio.vendor.cinematic_skill import engine as E
    if E.FONT_ROLES is not OFL_ROLES:
        E.FONT_ROLES.clear()
        E.FONT_ROLES.update({k: list(v) for k, v in OFL_ROLES.items()})


def resolved_manifest() -> list[dict]:
    """Per role: the family actually resolved on this machine and its licence (None = disallowed/system default)."""
    from clips_worker.motion_studio.vendor.cinematic_skill import engine as E
    apply()
    out = []
    for role in OFL_ROLES:
        tf, desc = E.resolve_typeface(role)
        fam = tf.getFamilyName() if tf is not None else None
        out.append({"role": role, "family": fam, "description": desc, "licence": FONT_LICENCES.get(fam or "")})
    return out
