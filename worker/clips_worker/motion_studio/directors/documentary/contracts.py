"""Typed, versioned contracts between Motion Studio roles (spec 7).

Creative agents decide WHAT the film is. The Motion Engineer decides HOW to
implement it. The deterministic engine executes. These contracts are data, not agents.
"""
from __future__ import annotations

from typing import Any, Literal

CONTRACT_VERSION = "1.0"

Role = Literal[
    "film_director",
    "production_designer",
    "motion_engineer",
    "visual_reviewer",
    "media_planning",
    "deterministic_engine",
]

# Film Director (existing director + story + research, no duplicates) I/O.
FILM_DIRECTOR = {
    "version": CONTRACT_VERSION,
    "role": "film_director",
    "input": ["story", "research", "catalog", "userBrief"],
    "output": ["productionPlan"],
    "writesCode": False,
    "writesDatabase": False,
}

# Production Designer: creative only. No Python, rendering, or DB mutation.
PRODUCTION_DESIGNER = {
    "version": CONTRACT_VERSION,
    "role": "production_designer",
    "input": ["story", "mediaCatalog", "filmIdentity", "sequenceContext"],
    "output": ["visualBlueprint"],
    "writesCode": False,
    "writesDatabase": False,
    "blueprintFields": [
        "version",
        "filmIdentity",
        "environments",
        "scenes",
        "customVisualConcepts",
        "objectDesigns",
        "assetSelections",
        "composition",
        "animationIntent",
        "transitions",
        "missingNeeds",
    ],
}

# Motion Engineer: technical only.
MOTION_ENGINEER = {
    "version": CONTRACT_VERSION,
    "role": "motion_engineer",
    "input": ["approvedBlueprint", "requiredAssets", "timeAnchors", "toolRegistry", "engineCapabilities"],
    "output": ["sceneSpec", "customComponent", "dependencies", "limitation"],
    "writesCode": "tier3_extension_only",
    "writesDatabase": False,
}

# Deterministic engine is not an agent.
DETERMINISTIC_ENGINE = {
    "version": CONTRACT_VERSION,
    "role": "deterministic_engine",
    "isAgent": False,
    "input": ["sceneSpec", "customCode"],
    "output": ["renderPlan", "errors"],
    "writesDatabase": "authorized_services_only",
}

VISUAL_REVIEWER = {
    "version": CONTRACT_VERSION,
    "role": "visual_reviewer",
    "input": ["storyboard", "renderedFrames", "audio", "approvedBlueprint"],
    "output": ["correctionRequest"],
    "writesCode": False,
    "writesDatabase": False,
}


def limitation(
    reason: str,
    *,
    missing_tools: list[str] | None = None,
    missing_assets: list[str] | None = None,
    unblock: str = "Revise the visual blueprint so it can be implemented with registered tools or a justified extension.",
) -> dict[str, Any]:
    """Structured limitation returned to the Production Designer for revision."""
    return {
        "version": CONTRACT_VERSION,
        "kind": "limitation",
        "fromRole": "motion_engineer",
        "toRole": "production_designer",
        "reason": reason,
        "missingTools": missing_tools or [],
        "missingAssets": missing_assets or [],
        "unblock": unblock,
    }


def is_limitation(payload: dict | None) -> bool:
    return isinstance(payload, dict) and (
        payload.get("kind") == "limitation" or isinstance(payload.get("limitation"), dict)
    )


def extract_limitation(payload: dict) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    if payload.get("kind") == "limitation":
        return payload
    inner = payload.get("limitation")
    if isinstance(inner, dict):
        return limitation(
            str(inner.get("reason") or "Design is not implementable with the current tools and assets."),
            missing_tools=list(inner.get("missingTools") or []),
            missing_assets=list(inner.get("missingAssets") or []),
            unblock=str(inner.get("unblock") or inner.get("request") or ""),
        )
    return None


FORBIDDEN_BLUEPRINT_KEYS = ("code", "python", "build_scene", "sql", "dbWrite", "renderFrames")


def validate_blueprint(blueprint: dict[str, Any] | None) -> list[str]:
    """A Production Designer blueprint must be structured visual intent, never code or DB ops."""
    problems: list[str] = []
    if not isinstance(blueprint, dict):
        return ["blueprint must be an object"]
    if blueprint.get("version") and blueprint.get("version") != CONTRACT_VERSION:
        problems.append(f"unsupported blueprint version {blueprint.get('version')!r}")
    for key in FORBIDDEN_BLUEPRINT_KEYS:
        if key in blueprint and blueprint[key]:
            problems.append(f"Production Designer must not emit {key!r}; this role writes no Python, rendering or DB mutation.")
    # Nested code dumps are also forbidden.
    blob = _walk_strings(blueprint)
    if "def build_scene(" in blob or "from motion_core import" in blob:
        problems.append("Production Designer must not emit scene Python in the blueprint.")
    return problems


def _walk_strings(value: Any, acc: list[str] | None = None) -> str:
    acc = acc if acc is not None else []
    if isinstance(value, str):
        acc.append(value)
    elif isinstance(value, dict):
        for v in value.values():
            _walk_strings(v, acc)
    elif isinstance(value, list):
        for v in value:
            _walk_strings(v, acc)
    return "\n".join(acc)
