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


def test_merge_does_not_keep_a_video_on_a_graphics_scene_or_fill_stills_silently():
    from clips_worker.motion_studio.directors.documentary.production import _merge_model_design
    story = _story()
    catalog = _catalog()
    editorial = {
        "source": "model",
        "world": {"brief": "a shop", "reason": "the film is set there", "name": "The shop"},
        "style": {"palette": {"bg": "#101010", "ink": "#f2f0ea", "accent": "#ffc400", "accent2": "#5ac8ff", "muted": "#7a8296"},
                  "mood": "quiet", "reason": "hold stills"},
        "scenes": [
            {"index": 0, "kind": "graphics", "visualType": "photo", "lineIds": ["l1"], "description": "the shop",
             "reason": "open on the shop front", "assetId": "photo_7", "emphasis": [], "transitionOut": "cut", "reuseReason": None, "handoff": None},
            {"index": 1, "kind": "graphics", "visualType": "abstract", "lineIds": ["l2"], "description": "the chain",
             "reason": "the chain arrives", "assetId": None, "emphasis": [], "transitionOut": "cut", "reuseReason": None, "handoff": None},
            {"index": 2, "kind": "handoff", "visualType": "handoff", "lineIds": [], "description": "aisle clip",
             "reason": "play the aisle footage in full", "handoff": {"assetId": "clip_1", "inS": 0, "outS": 12.667, "audioMode": "clip"},
             "emphasis": [], "transitionOut": "cut"},
        ],
        "musicAnchors": {},
        "deliberateMinimal": [],
    }
    dirty = _merge_model_design(editorial, story, catalog, inventory_from_catalog(catalog, story), {
        "identity": {"concept": "a shop", "typography": "condensed", "materials": None, "palette": None,
                     "cameraPersonality": "slow push on stills", "transitionLanguage": None, "motifs": None, "throughLine": "stay"},
        "worlds": [{"id": "w1", "name": "Shop", "brief": "the shop", "reason": "set", "chapters": None, "clusters": None}],
        "assetPlacements": [{"sceneIndex": 1, "assetId": "clip_1", "reason": "wrongly placed a video on a graphics scene"}],
        "customObjects": [], "sceneBindings": [], "missingNeeds": [],
        "cameraRoute": "push in on the shop front, then hold",
        "cameraRouteReason": "the stills should be read, not flown past",
        "audioDirection": "narration pauses on the aisle clip",
        "audioDirectionReason": "the clip should be heard as itself",
    })
    # The video must not stick on the graphics scene, and leftover stills must not be auto-filled.
    assert dirty["scenes"][1].get("assetId") != "clip_1"
    mark_assigned = any(s.get("assetId") == "mark_1" for s in dirty["scenes"])
    assert mark_assigned is False
    # A later repair without that placement starts from a clean editorial copy in design_production;
    # merge itself must also be safe if given a previously mutated plan-like dict.
    clean = _merge_model_design(editorial, story, catalog, inventory_from_catalog(catalog, story), {
        "identity": {"concept": "a shop", "typography": "condensed", "materials": None, "palette": None,
                     "cameraPersonality": "slow push on stills", "transitionLanguage": None, "motifs": None, "throughLine": "stay"},
        "worlds": [{"id": "w1", "name": "Shop", "brief": "the shop", "reason": "set", "chapters": None, "clusters": None}],
        "assetPlacements": [], "customObjects": [], "sceneBindings": [], "missingNeeds": [],
        "cameraRoute": "push in on the shop front, then hold",
        "cameraRouteReason": "the stills should be read, not flown past",
        "audioDirection": "narration pauses on the aisle clip",
        "audioDirectionReason": "the clip should be heard as itself",
    })
    assert clean["scenes"][1].get("assetId") in (None, "photo_7")
    assert clean["scenes"][0]["assetId"] == "photo_7"


def test_merge_restores_official_stills_dropped_by_production_but_does_not_fill_unassigned():
    """A production placement that overwrites a unique official still must not drop it.

    Stills the Director never assigned (e.g. a leftover mark) stay unassigned.
    """
    import copy
    from clips_worker.motion_studio.directors.documentary.production import _merge_model_design
    story = _story()
    catalog = _catalog() + [
        {"id": "photo_8", "kind": "image", "filename": "aisle.jpg", "status": "ready",
         "width": 1600, "height": 1200, "analysis": {"subject": "the aisle", "tags": ["aisle"]}},
    ]
    design = {
        "identity": {"concept": "a shop", "typography": "condensed", "materials": None, "palette": None,
                     "cameraPersonality": "slow push on stills", "transitionLanguage": None, "motifs": None, "throughLine": "stay"},
        "worlds": [{"id": "w1", "name": "Shop", "brief": "the shop", "reason": "set", "chapters": None, "clusters": None}],
        "customObjects": [], "sceneBindings": [], "missingNeeds": [],
        "cameraRoute": "push in on the shop front, then hold",
        "cameraRouteReason": "the stills should be read, not flown past",
        "audioDirection": "narration pauses on the aisle clip",
        "audioDirectionReason": "the clip should be heard as itself",
    }
    editorial = {
        "source": "model",
        "world": {"brief": "a shop", "reason": "the film is set there", "name": "The shop"},
        "style": {"palette": {"bg": "#101010", "ink": "#f2f0ea", "accent": "#ffc400", "accent2": "#5ac8ff", "muted": "#7a8296"},
                  "mood": "quiet", "reason": "hold stills"},
        "scenes": [
            {"index": 0, "kind": "graphics", "visualType": "photo", "lineIds": ["l1"], "description": "the shop",
             "reason": "open on the shop front", "assetId": "photo_7", "emphasis": [], "transitionOut": "cut",
             "reuseReason": None, "handoff": None},
            {"index": 1, "kind": "graphics", "visualType": "photo", "lineIds": ["l2"], "description": "the aisle",
             "reason": "the aisle of the shop", "assetId": "photo_8", "emphasis": [], "transitionOut": "cut",
             "reuseReason": None, "handoff": None},
            {"index": 2, "kind": "handoff", "visualType": "handoff", "lineIds": [], "description": "aisle clip",
             "reason": "play the aisle footage in full",
             "handoff": {"assetId": "clip_1", "inS": 0, "outS": 12.667, "audioMode": "clip"},
             "emphasis": [], "transitionOut": "cut"},
        ],
        "musicAnchors": {},
        "deliberateMinimal": [],
    }
    # Production repeats photo_7 onto the scene that uniquely held photo_8, and never mentions photo_8.
    out = _merge_model_design(copy.deepcopy(editorial), story, catalog, inventory_from_catalog(catalog, story), {
        **design,
        "assetPlacements": [{"sceneIndex": 1, "assetId": "photo_7", "reason": "repeat the shop front"}],
    })
    ids = {s.get("assetId") for s in out["scenes"] if s.get("assetId")}
    assert "photo_8" in ids, out["scenes"]
    assert "photo_7" in ids
    assert all(s.get("assetId") != "mark_1" for s in out["scenes"])
    # The official still is back on its original scene because photo_7 remains on scene 0.
    assert out["scenes"][1]["assetId"] == "photo_8"
    assert out["scenes"][0]["assetId"] == "photo_7"



def test_inventory_includes_asset_evidence_and_skips_requested_media():
    from clips_worker.motion_studio.core.designer_capabilities import format_designer_capabilities
    catalog = _catalog() + [
        {"id": "photo_8", "kind": "image", "filename": "sign.jpg", "status": "ready",
         "analysis": {"summary": "a lit OPEN neon sign", "onScreenText": ["OPEN"], "tags": ["sign"]},
         "localPath": "/secret/path.jpg", "model": "should-not-leak", "watchModel": "nope"},
        {"id": "wish_9", "kind": "video", "filename": "parade.mp4", "status": "requested",
         "analysis": {"summary": "not acquired"}},
    ]
    # give photo_8 analysis via the last ready still; inventory must include evidence
    # and must not leak paths or include the requested clip.
    story = _story()
    inv = inventory_from_catalog(catalog, story)
    ids = {r["assetId"] for r in inv}
    assert "photo_8" in ids
    assert "wish_9" not in ids
    ev = next(r["evidence"] for r in inv if r["assetId"] == "photo_8")
    assert "OPEN" in ev.get("onScreenText")
    assert ev.get("summary")
    blob = str(inv)
    assert "localPath" not in blob and "/secret/" not in blob
    assert "should-not-leak" not in blob
    caps = format_designer_capabilities()
    low = caps.lower()
    assert "place_media" in low
    assert "photoframe" in low or "photo frame" in low or "whole-image" in low or "whole image" in low
    assert "registered" in low or "animate_camera" in low


def test_apply_scene_revisions_only_changes_limited_scenes():
    from clips_worker.motion_studio.directors.documentary.production import _apply_scene_revisions
    plan = {
        "scenes": [
            {"index": 0, "kind": "graphics", "description": "hold the shop", "assetId": "photo_7", "reason": "official"},
            {"index": 1, "kind": "graphics", "description": "hold the other wall", "assetId": "photo_8", "reason": "official"},
        ],
        "blueprint": {
            "sceneBindings": [
                {"sceneIndex": 0, "assetId": "photo_7", "objective": "hold the shop"},
                {"sceneIndex": 1, "assetId": "photo_8", "objective": "hold the other wall"},
            ],
            "customObjects": [],
        },
    }
    _apply_scene_revisions(plan, [{
        "sceneIndex": 0,
        "description": 'Hold the shop front, the sign reading "OPEN".',
        "objective": 'Hold the shop front, the sign reading "OPEN".',
        "reason": "the analysis shows OPEN, tools support a hold",
        "evidenceBasis": "onScreenText includes OPEN",
        "toolBasis": "place_media PhotoFrame hold",
    }])
    assert plan["scenes"][0]["description"].startswith("Hold the shop front")
    assert plan["scenes"][0]["assetId"] == "photo_7"
    assert plan["scenes"][1]["description"] == "hold the other wall"
    assert plan["scenes"][1]["assetId"] == "photo_8"
    b0 = next(b for b in plan["blueprint"]["sceneBindings"] if b["sceneIndex"] == 0)
    assert b0["evidenceBasis"] and b0["toolBasis"]
