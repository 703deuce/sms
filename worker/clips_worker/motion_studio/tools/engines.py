"""Future render engines register their own tools and adapters here.

When Dolly, HyperFrames, Open 3D Skills or Remotion are introduced, each
framework gets a registered adapter with exact capability descriptions and a
deterministic compiler. Motion Studio currently executes the Cinematic Skill
engine (motion_core). Agents must not guess a framework API; they select a
registered engine and call its tools.
"""
from __future__ import annotations

CURRENT_ENGINE = "cinematic_skill"

ENGINES: dict[str, dict] = {
    "cinematic_skill": {
        "id": "cinematic_skill",
        "status": "active",
        "tools": "clips_worker.motion_studio.tools",
        "compiler": "clips_worker.motion_studio.tools.compiler",
        "capabilities": "motion_core API manifest + registered tools",
    },
    "dolly": {"id": "dolly", "status": "reserved", "tools": None, "compiler": None,
              "capabilities": "Registered when Dolly is introduced."},
    "hyperframes": {"id": "hyperframes", "status": "reserved", "tools": None, "compiler": None,
                    "capabilities": "Registered when HyperFrames is introduced."},
    "open_3d_skills": {"id": "open_3d_skills", "status": "reserved", "tools": None, "compiler": None,
                       "capabilities": "Registered when Open 3D Skills is introduced."},
    "remotion": {"id": "remotion", "status": "reserved", "tools": None, "compiler": None,
                 "capabilities": "Registered when Remotion is introduced."},
}


def get_engine(engine_id: str | None = None) -> dict:
    eid = engine_id or CURRENT_ENGINE
    if eid not in ENGINES:
        raise KeyError(f"Unknown render engine {eid!r}. Choose a registered engine; do not guess its API.")
    return ENGINES[eid]


def available_engines() -> list[dict]:
    return [dict(v) for v in ENGINES.values()]
