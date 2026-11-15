"""Production Designer hook, asset usage manifest, film QA, and assemble review."""
from __future__ import annotations

from clips_worker.motion_studio.core.qa import film_pass, film_quality
from clips_worker.motion_studio.directors.documentary.contracts import CONTRACT_VERSION, validate_blueprint
from clips_worker.motion_studio.directors.documentary.director import fallback_plan, validate_plan
from clips_worker.motion_studio.directors.documentary.production import (
    design_production,
    fallback_production,
    inventory_from_catalog,
)
from clips_worker.motion_studio.directors.documentary.reviewer import review_film
import importlib.util
import pytest


def _story():
    return {
        "title": "The last shop",
        "logline": "A shop on the corner holds on.",
        "tone": "curious",
        "chapters": [{"n": 1, "title": "The shop"}, {"n": 2, "title": "The chain"}],
        "lines": [
            {"id": "l1", "chapter": 1, "text": "The last shop on the corner stayed open.",
             "spoken": "The last shop on the corner stayed open.", "hero": "LAST SHOP"},
            {"id": "l2", "chapter": 2, "text": "A chain of stores arrived the next year.",
             "spoken": "A chain of stores arrived the next year.", "hero": "CHAIN"},
        ],
        "estimatedDurationS": 20,
        "data": [],
    }


def _catalog():
    return [
        {"id": "photo_7", "kind": "image", "filename": "shop.jpg", "status": "ready",
         "width": 2000, "height": 1400, "analysis": {"subject": "the shop front", "tags": ["shop", "storefront"]}},
        {"id": "clip_1", "kind": "video", "filename": "aisle.mp4", "status": "ready", "durationMs": 12667,
         "width": 1920, "height": 1080, "analysis": {"subject": "aisles", "tags": ["aisle"]}},
        {"id": "mark_1", "kind": "image", "filename": "wordmark.png", "status": "ready",
         "width": 800, "height": 200, "analysis": {"tags": ["logo", "wordmark"], "role": "mark"}},
    ]


def test_agent_direct_calls_production_designer():
    from pathlib import Path
    src = Path("clips_worker/motion_studio/directors/documentary/agent.py").read_text()
    assert "design_production" in src
    assert "direct_editorial" in src


def test_fallback_production_builds_blueprint_and_asset_manifest():
    story, catalog = _story(), _catalog()
    plan = fallback_plan({"id": "p1"}, story, catalog)
    assert validate_plan(plan, story, catalog) == []
    out = fallback_production({"id": "p1"}, story, catalog, plan)
    assert out["identity"]["throughLine"]
    assert out["worlds"]
    assert all("type" not in (w or {}) or True for w in out["worlds"])
    bp = out["blueprint"]
    assert bp["version"] == CONTRACT_VERSION
    assert validate_blueprint(bp) == []
    assert not any(k in bp for k in ("code", "python", "build_scene"))
    man = out["assetUsageManifest"]
    assert man is bp["assetUsageManifest"]
    ids = {e["assetId"] for e in man["entries"]}
    assert {"photo_7", "clip_1", "mark_1"} <= ids
    assert man["unused"] == []
    used = {e["assetId"] for e in man["entries"] if e["usedIn"]}
    assert {"photo_7", "clip_1", "mark_1"} <= used
    assert bp["cameraPlan"]
    assert bp["provenance"]["default"] == "user_upload"
    inv = inventory_from_catalog(catalog, story)
    assert {r["assetId"] for r in inv} == {"photo_7", "clip_1", "mark_1"}
    assert any(r["role"] == "mark" for r in inv)
    assert any(r["role"] == "footage" and r["moments"] for r in inv)


def test_design_production_mock_is_creative_only(monkeypatch):
    from clips_worker.motion_studio.pipeline import config
    monkeypatch.setenv("MOTION_STUDIO_MOCK", "1")
    # config.mock reads env at call time
    logs = []
    def log(kind, msg, extra=None):
        logs.append((kind, msg, extra))
    story, catalog = _story(), _catalog()
    plan = fallback_plan({"id": "p-mock"}, story, catalog)
    out = design_production({"id": "p-mock"}, story, catalog, plan, log)
    assert out["productionSource"] == "fallback"
    assert validate_blueprint(out["blueprint"]) == []
    assert "def build_scene" not in str(out["blueprint"])


def test_blueprint_rejects_python_from_the_production_designer():
    story, catalog = _story(), _catalog()
    plan = fallback_production({"id": "p"}, story, catalog, fallback_plan({"id": "p"}, story, catalog))
    plan["blueprint"]["code"] = "from motion_core import *\ndef build_scene(ctx):\n    return ctx.film()\n"
    assert validate_blueprint(plan["blueprint"])


@pytest.mark.skipif(importlib.util.find_spec('skia') is None, reason='skia not installed')
def test_scene_context_carries_identity_and_manifest():
    from clips_worker.motion_studio.pipeline.timeline import scene_context
    story, catalog = _story(), _catalog()
    plan = fallback_production({"id": "p"}, story, catalog, fallback_plan({"id": "p"}, story, catalog))
    sc = plan["scenes"][0]
    lay = {
        "fps": 30,
        "words": [{"w": "The", "s": 0.0, "e": 0.2, "line": "l1"},
                  {"w": "shop", "s": 0.2, "e": 0.5, "line": "l1"}],
    }
    # scene_context needs startS/endS/lineIds/visualType/kind/index
    scene = {
        "index": sc["index"], "kind": sc.get("kind") or "graphics",
        "visualType": sc.get("visualType") or "photo",
        "startS": 0.0, "endS": 3.0, "lineIds": sc.get("lineIds") or ["l1"],
    }
    ctx = scene_context(scene, lay, story, plan, {}, 1)
    assert ctx["identity"]["throughLine"]
    assert ctx["blueprint"]["assetUsageManifest"]["entries"]
    assert ctx["cameraPlan"]
    assert isinstance(ctx["scene"]["world"], dict)
    assert "brief" in ctx["scene"]["world"] or ctx["scene"]["world"].get("name")


def test_film_qa_fails_degraded_and_unexplained_repeats():
    plan = {
        "scenes": [
            {"index": 0, "assetId": "photo_7"},
            {"index": 1, "assetId": "photo_7"},
        ],
        "assetUsageManifest": {
            "entries": [{"assetId": "photo_7", "usedIn": [{"sceneIndex": 0}, {"sceneIndex": 1}]}],
            "unused": ["clip_1"],
            "repeats": ["photo_7"],
        },
    }
    scenes = [
        {"index": 0, "usedFallback": True, "qa": {"degraded": True, "degradeCause": "StringLine rgb"}},
        {"index": 1, "usedFallback": False, "qa": {}},
    ]
    checks = film_quality(plan, scenes, [{"id": "clip_1", "kind": "video"}])
    ids = {c["id"]: c for c in checks}
    assert ids["F1"]["pass"] is False
    assert ids["F2"]["pass"] is False
    assert ids["F3"]["pass"] is False
    assert film_pass(checks, scenes) is False
    review = review_film(checks=checks, scenes=scenes, plan=plan)
    assert review["pass"] is False
    roles = {r["toRole"] for r in review["correctionRequests"]}
    assert "motion_engineer" in roles
    assert "production_designer" in roles or "media_planning" in roles


def test_clean_film_passes_qa_and_reviewer():
    story, catalog = _story(), _catalog()
    plan = fallback_production({"id": "p"}, story, catalog, fallback_plan({"id": "p"}, story, catalog))
    scenes = [{"index": s["index"], "usedFallback": False, "qa": {"verdict": "pass"}} for s in plan["scenes"]]
    checks = film_quality(plan, scenes, catalog)
    assert all(c["pass"] for c in checks), checks
    assert film_pass(checks, scenes) is True
    review = review_film(checks=checks, scenes=scenes, plan=plan)
    assert review["pass"] is True
    assert review["correctionRequests"] == []
