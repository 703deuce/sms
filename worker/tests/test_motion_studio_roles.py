"""Role split contracts, reviewer routing, and per-stage model config (spec 7)."""
from __future__ import annotations

from clips_worker.motion_studio.directors.documentary.contracts import (
    CONTRACT_VERSION,
    MOTION_ENGINEER,
    PRODUCTION_DESIGNER,
    limitation,
    validate_blueprint,
)
from clips_worker.motion_studio.directors.documentary.reviewer import route_issue, route_issues
from clips_worker.motion_studio.pipeline import config


def test_contracts_are_versioned_and_roles_are_specialized():
    assert CONTRACT_VERSION == "1.0"
    assert PRODUCTION_DESIGNER["writesCode"] is False
    assert PRODUCTION_DESIGNER["writesDatabase"] is False
    assert "visualBlueprint" in PRODUCTION_DESIGNER["output"]
    assert MOTION_ENGINEER["writesCode"] == "tier3_extension_only"
    assert "approvedBlueprint" in MOTION_ENGINEER["input"]
    assert "limitation" in MOTION_ENGINEER["output"]


def test_blueprint_rejects_scene_python_and_db_writes():
    ok = {
        "version": CONTRACT_VERSION,
        "filmIdentity": {"palette": {"bg": [10, 10, 10]}},
        "environments": [{"id": "env_desk", "brief": "a worn desk"}],
        "scenes": [{"id": "scene_12", "environmentId": "env_desk"}],
        "assetSelections": [{"assetId": "photo_7", "role": "print"}],
    }
    assert validate_blueprint(ok) == []
    bad = dict(ok)
    bad["code"] = "from motion_core import *\ndef build_scene(ctx):\n    return ctx.film()\n"
    probs = validate_blueprint(bad)
    assert any("code" in p.lower() or "python" in p.lower() for p in probs)


def test_limitation_routes_to_the_production_designer():
    lim = limitation("no registered tool can simulate cloth", missing_tools=["cloth"])
    assert lim["toRole"] == "production_designer"
    assert lim["fromRole"] == "motion_engineer"
    assert lim["version"] == CONTRACT_VERSION


def test_reviewer_routes_issues_to_the_responsible_role_only():
    cases = [
        ({"kind": "creative", "detail": "the desk feels generic"}, "production_designer"),
        ({"kind": "composition", "detail": "the photo sits too low"}, "production_designer"),
        ({"kind": "api", "detail": "StringLine unexpected kwarg rgb"}, "motion_engineer"),
        ({"kind": "render", "detail": "sandbox TypeError"}, "motion_engineer"),
        ({"kind": "lint", "detail": "undefined name skia"}, "motion_engineer"),
        ({"kind": "editorial", "detail": "the scene overstays the line"}, "film_director"),
        ({"kind": "story", "detail": "this beat is in the wrong act"}, "film_director"),
        ({"kind": "missing_asset", "detail": "the warehouse clip was never assigned"}, "media_planning"),
        ({"kind": "inappropriate_asset", "detail": "unrelated stock still"}, "media_planning"),
    ]
    for issue, role in cases:
        rec = route_issue(issue)
        assert rec["toRole"] == role, (issue, rec)
        assert rec["repairInOtherRole"] is False
        assert rec["fromRole"] == "visual_reviewer"
    routed = route_issues([c[0] for c in cases])
    assert [r["toRole"] for r in routed] == [c[1] for c in cases]


def test_all_roles_default_to_luna_and_per_stage_config_still_works(monkeypatch):
    monkeypatch.delenv("MOTION_STUDIO_MODEL", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_SCENE_CODE", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_MOTION_ENGINEER", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_PRODUCTION_DESIGNER", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_VISUAL_REVIEWER", raising=False)
    config.apply_project_settings({})
    for step in (
        "story", "director", "production_designer", "motion_engineer",
        "scene_code", "scene_fix", "visual_reviewer", "critic", "storyboard",
    ):
        assert config.model_for(step) == "gpt-6-luna", step
    # Dedicated per-stage keys still work so a later comparison is a config change.
    monkeypatch.setenv("MOTION_STUDIO_MODEL_PRODUCTION_DESIGNER", "gpt-6.1-sol")
    assert config.model_for("production_designer") == "gpt-6.1-sol"
    assert config.model_for("motion_engineer") == "gpt-6-luna"
    # Existing scene_code config applies to the engineer until a dedicated key is set.
    monkeypatch.setenv("MOTION_STUDIO_MODEL_SCENE_CODE", "gpt-6.1-sol")
    assert config.model_for("motion_engineer") == "gpt-6.1-sol"
    monkeypatch.setenv("MOTION_STUDIO_MODEL_MOTION_ENGINEER", "gpt-6-luna")
    assert config.model_for("motion_engineer") == "gpt-6-luna"
    config.apply_project_settings({
        "models": {"production_designer": "gpt-6.1-sol", "motion_engineer": "gpt-6-luna"},
    })
    assert config.model_for("production_designer") == "gpt-6.1-sol"
    assert config.model_for("motion_engineer") == "gpt-6-luna"
    config.apply_project_settings({})
    monkeypatch.delenv("MOTION_STUDIO_MODEL_SCENE_CODE", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_MOTION_ENGINEER", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_PRODUCTION_DESIGNER", raising=False)
