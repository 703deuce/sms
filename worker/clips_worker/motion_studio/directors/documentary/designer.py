"""Compatibility shim: the scene-code loop is now the Motion Engineer (spec 7).

Existing imports of `design_scene`, `probe_times`, `lint` helpers and
`api_excerpt_for` keep working. Creative decisions belong to the Production
Designer; this module no longer owns them.
"""
from clips_worker.motion_studio.directors.documentary.engineer import (  # noqa: F401
    SYSTEM,
    api_excerpt_for,
    approved_candidate,
    code_hash,
    design_scene,
    measure,
    probe_times,
)

__all__ = [
    "SYSTEM",
    "api_excerpt_for",
    "approved_candidate",
    "code_hash",
    "design_scene",
    "measure",
    "probe_times",
]
