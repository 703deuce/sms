"""Visual Reviewer: evaluate renders against the approved blueprint and route issues.

This module routes problems; it does not repair them. No agent repairs outside
its responsibility.
"""
from __future__ import annotations

from typing import Any

from clips_worker.motion_studio.directors.documentary.contracts import CONTRACT_VERSION, Role

# Issue kind / tags -> responsible role.
_ROUTES: tuple[tuple[tuple[str, ...], Role, str], ...] = (
    (("editorial", "story", "pacing", "structure", "narration"), "film_director",
     "Editorial or story issues go to the Film Director."),
    (("missing_asset", "inappropriate_asset", "asset", "media_planning", "unused_upload"), "media_planning",
     "Missing or inappropriate assets go to media planning."),
    (("code", "api", "render", "sandbox", "lint", "compiler", "signature", "constructor"), "motion_engineer",
     "Code, API and render issues go to the Motion Engineer."),
    (("creative", "design", "composition", "environment", "animation_intent", "transition", "identity"),
     "production_designer",
     "Creative design issues go to the Production Designer."),
)


def route_issue(issue: dict[str, Any]) -> dict[str, Any]:
    """Return a correction request naming the one responsible role."""
    tags = _tags(issue)
    for keys, role, reason in _ROUTES:
        if any(k in tags for k in keys):
            return _request(role, issue, reason)
    # Default: creative design, not a silent code rewrite.
    return _request("production_designer", issue, "Unclassified visual issues go to the Production Designer, not a silent code rewrite.")


def route_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [route_issue(i) for i in issues or []]


def _tags(issue: dict[str, Any]) -> set[str]:
    raw = []
    for key in ("kind", "category", "type", "target"):
        if issue.get(key):
            raw.append(str(issue[key]))
    raw.extend(str(t) for t in (issue.get("tags") or []))
    blob = (issue.get("detail") or issue.get("message") or "") + " " + " ".join(raw)
    return {p.strip().lower().replace(" ", "_") for p in raw} | {
        w.strip().lower() for w in blob.replace("/", " ").replace("-", "_").split() if w.strip()
    }


def _request(role: Role, issue: dict[str, Any], reason: str) -> dict[str, Any]:
    return {
        "version": CONTRACT_VERSION,
        "kind": "correction_request",
        "fromRole": "visual_reviewer",
        "toRole": role,
        "reason": reason,
        "issue": issue,
        "repairInOtherRole": False,
    }
