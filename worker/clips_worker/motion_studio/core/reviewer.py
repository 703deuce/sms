"""Visual Reviewer: evaluate renders against the approved blueprint and route issues.

This module routes problems; it does not repair them. No agent repairs outside
its responsibility.
"""
from __future__ import annotations

from typing import Any, Literal

CONTRACT_VERSION = "1.0"
Role = Literal[
    "film_director", "production_designer", "motion_engineer",
    "visual_reviewer", "media_planning", "deterministic_engine",
]

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


def issues_from_film(*, checks: list[dict] | None = None, scenes: list[dict] | None = None, plan: dict | None = None) -> list[dict]:
    """Turn QA failures and degraded scenes into typed issues for routing."""
    issues: list[dict] = []
    for c in checks or []:
        if c.get("pass"):
            continue
        cid = str(c.get("id") or "")
        detail = str(c.get("detail") or "")
        blob = (cid + " " + detail).lower()
        if cid == "F1" or "degraded" in blob or "fallback" in blob or cid in {"A15"}:
            kind = "render"
        elif cid in {"A5", "A18"} or "lint" in blob or "api" in blob or "signature" in blob or "constructor" in blob:
            kind = "api"
        elif cid == "F3" or "unused" in blob or "missing" in blob and "asset" in blob:
            kind = "missing_asset"
        elif cid == "F2" or "repeat" in blob:
            kind = "creative"
        elif "editorial" in blob or "pacing" in blob or "story" in blob:
            kind = "editorial"
        elif cid == "A14" or "empty" in blob:
            kind = "creative"
        else:
            kind = "creative"
        issues.append({
            "kind": kind,
            "id": cid,
            "detail": detail,
            "severity": c.get("severity") or "error",
        })
    for s in scenes or []:
        qa_blob = s.get("qa") or {}
        if qa_blob.get("limitation"):
            lim = qa_blob["limitation"]
            issues.append({
                "kind": "creative",
                "id": "limitation",
                "detail": (lim.get("reason") if isinstance(lim, dict) else str(lim)),
                "sceneIndex": s.get("index"),
                "severity": "error",
            })
        elif s.get("usedFallback") or qa_blob.get("degraded"):
            issues.append({
                "kind": "render",
                "id": "F1",
                "detail": qa_blob.get("degradeCause") or "scene used a framework fallback",
                "sceneIndex": s.get("index"),
                "severity": "error",
            })
    return issues


def review_film(*, checks: list[dict] | None = None, scenes: list[dict] | None = None,
                plan: dict | None = None, storyboard: dict | None = None, audio: dict | None = None) -> dict:
    """Evaluate the assembled film against the approved blueprint and route every issue."""
    issues = issues_from_film(checks=checks, scenes=scenes, plan=plan)
    requests = route_issues(issues)
    return {
        "version": CONTRACT_VERSION,
        "fromRole": "visual_reviewer",
        "toRoles": sorted({r["toRole"] for r in requests}),
        "issues": issues,
        "correctionRequests": requests,
        "pass": not any((i.get("severity") or "error") != "warn" for i in issues),
        "storyboardPresent": bool(storyboard),
        "audioPresent": bool(audio),
    }
