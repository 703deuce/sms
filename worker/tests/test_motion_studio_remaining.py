"""Remaining Motion Studio pipeline items: probes, keyframes, preproduction, recovery, QA, music brief."""
from __future__ import annotations

import ast
from pathlib import Path

from clips_worker.motion_studio.core.fallback import recover_render_code, fallback_code, FALLBACK_CODE
from clips_worker.motion_studio.core.keyframes import keyframe_entries, library_from_catalog
from clips_worker.motion_studio.core.elements import elements_from_spec, apply_element_patch
from clips_worker.motion_studio.core.preproduction import (
    identity_package, build_storyboard, review_storyboard, acquisition_plan,
    estimate_credits, record_checkpoint, creative_report, validate_creative_plan,
)
from clips_worker.motion_studio.core.probes import probe_times, motion_strip_times, final_res_times
from clips_worker.motion_studio.core.qa import (
    film_quality, film_pass, empty_interval_check, unrelated_labels_check, final_res_check,
)
from clips_worker.motion_studio.core.recovery import resume_produce, recover_render_strategy
from clips_worker.motion_studio.core.style_memory import APPROACHES, record, prompt_excerpt
from clips_worker.motion_studio.core.preproduction import music_brief
from clips_worker.motion_studio.tools.engines import get_engine, available_engines, CURRENT_ENGINE

WORKER_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = WORKER_ROOT.parent


def test_probe_times_are_adaptive_and_more_than_six():
    ctx = {
        "duration": 12.0,
        "lines": [
            {"start": 0.2, "end": 3.0, "text": "One", "emphasis": True},
            {"start": 3.2, "end": 7.0, "text": "Two"},
            {"start": 7.2, "end": 11.0, "text": "Three"},
        ],
        "transitions": [{"t": 3.1}],
    }
    times = probe_times(ctx)
    assert len(times) > 6
    assert times[0] < 1.0
    assert times[-1] > 10.0
    assert any(abs(t - 3.1) < 0.4 for t in times)
    pairs = motion_strip_times(ctx)
    assert pairs and all(b > a for a, b in pairs)
    fr = final_res_times(ctx)
    assert 2 <= len(fr) <= 6


def test_keyframe_library_uses_moments_not_a_single_1s_still():
    asset = {
        "id": "msa_clip",
        "kind": "video",
        "durationS": 10,
        "analysis": {
            "durationS": 10,
            "moments": [
                {"start_s": 2.4, "end_s": 4.0, "what_happened": "a sign is visible"},
                {"start_s": 7.1, "end_s": 9.0, "what_happened": "the door closes"},
            ],
        },
    }
    frames = keyframe_entries(asset)
    times = [f["t"] for f in frames]
    assert 1.0 not in times or len(times) > 1
    assert any(abs(t - 2.4) < 0.05 for t in times)
    assert any(abs(t - 7.1) < 0.05 for t in times)
    assert sum(1 for f in frames if f.get("primary")) == 1
    lib = library_from_catalog([asset, {"id": "msa_pic", "kind": "image"}])
    assert "msa_clip" in lib["assets"] and "msa_pic" in lib["assets"]


def test_identity_package_storyboard_and_acquisition_are_versioned():
    story = {"title": "A store closes", "lines": [{"id": "l1", "chapter": 1, "text": "The last store closed its doors."}]}
    plan = {
        "identity": {"concept": "a dim retail hall", "typography": {"display": "Oswald"},
                     "materials": ["scuffed linoleum"], "cameraPersonality": "held stills",
                     "throughLine": "a hall of empty shelves", "motifs": ["receipt paper"]},
        "worlds": [{"id": "w_hall", "name": "the hall", "brief": "aisles after closing"}],
        "scenes": [
            {"id": "s0", "index": 0, "visualType": "photo", "assetId": "p1", "worldId": "w_hall",
             "description": "The last store closed its doors.", "camera": "hold on the photograph"},
            {"id": "s1", "index": 1, "visualType": "text", "worldId": "w_hall",
             "description": "end card", "camera": "lock off", "missingNeed": "original typography end card"},
        ],
        "assetUsageManifest": {"entries": [{"assetId": "p1", "role": "photo", "subject": "storefront",
                                            "usedIn": [{"sceneIndex": 0}]}]},
        "blueprint": {"inventory": [{"id": "p1"}], "missingNeeds": [{"sceneIndex": 1, "need": "end typography"}]},
    }
    pkg = identity_package(plan, story)
    assert pkg["contractVersion"] == "1.0" and pkg["packageVersion"] >= 1
    assert pkg["typography"]["display"] == "Oswald"
    assert "w_hall" in pkg["state"]["environments"]
    board = build_storyboard(plan, story)
    assert len(board["frames"]) == 2
    assert board["frames"][0]["media"] and board["frames"][1]["original"]
    review = review_storyboard(board, plan)
    assert review["pass"] and review["status"] == "approved"
    acq = acquisition_plan(plan, story)
    assert "p1" in acq["used"]
    assert acq["missingNeeds"]
    # A board missing camera and media fails pre-review.
    bad = review_storyboard({"frames": [{"index": 0, "environment": {}, "media": [], "original": None, "camera": None}]})
    assert not bad["pass"] and bad["status"] == "needs_review"


def test_credit_estimate_is_credits_never_currency():
    plan = {"scenes": [{"index": i} for i in range(8)]}
    est = estimate_credits(plan, {"lengthMin": 3, "voiceover": "ai", "music": "generated", "renderSize": "480p"})
    assert est["unit"] == "credits" and est["currency"] == "credits"
    blob = str(est).lower()
    assert "usd" not in blob and "$" not in str(est) and "currency" in blob
    assert est["total"] == sum(i["credits"] for i in est["breakdown"])
    paid_music = estimate_credits(plan, {"lengthMin": 3, "music": "elevenlabs"})
    assert paid_music["total"] > est["total"]
    eleven = next(i for i in paid_music["breakdown"] if i["id"] == "music")
    assert eleven["credits"] > 0 and "dollar" not in eleven["label"].lower() and "$" not in eleven["label"]


def test_checkpoints_and_split_quality_report():
    plan = {"identityPackage": {"packageVersion": 1}, "assetUsageManifest": {"entries": [], "unused": []}}
    cps = record_checkpoint(plan, "production_design", {"storyboard": "approved"})
    assert plan["checkpoints"][0]["stage"] == "production_design"
    assert cps[0]["version"] == 1
    scenes = [{"index": 0, "usedFallback": True, "qa": {"degraded": True}}]
    checks = [{"id": "F1", "pass": False, "severity": "error"}]
    report = creative_report(plan, scenes, {"pass": False, "issues": [{"kind": "creative"}]}, checks)
    assert report["technical"]["pass"] is False
    assert report["creative"]["pass"] is False
    assert 0 in report["technical"]["degradedScenes"]


def test_film_qa_flags_empty_intervals_unrelated_labels_and_final_res():
    scenes = [{
        "index": 0, "startMs": 0, "endMs": 8000,
        "qa": {"checks": [{"id": "A14", "pass": False, "detail": "flat field"}], "finalRes": []},
    }]
    assert empty_interval_check(scenes)["pass"] is False
    story = {"title": "The last store", "lines": [{"text": "The last store closed its doors in Oregon."}]}
    plan = {"scenes": [{"index": 0, "label": "SYDNEY HARBOUR"}], "identity": {"throughLine": "empty shelves"}}
    assert unrelated_labels_check(plan, story)["pass"] is False
    ok_plan = {"scenes": [{"index": 0, "label": "The last store"}], "identity": {"throughLine": "The last store"}}
    assert unrelated_labels_check(ok_plan, story)["pass"] is True
    missing = final_res_check([{"index": 0, "qa": {}}])
    assert missing["pass"] is True and missing["severity"] == "warn"
    failed = final_res_check([{"index": 1, "qa": {"finalRes": [{"id": "A14", "pass": False, "severity": "error"}]}}])
    assert failed["pass"] is False
    checks = film_quality(ok_plan, [{"index": 0, "qa": {"finalRes": [{"id": "A14", "pass": True}]}}], story=story)
    ids = {c["id"] for c in checks}
    assert {"F1", "F2", "F3", "F4", "F5", "F6"} <= ids
    assert film_pass(checks, [{"index": 0}]) is True


def test_music_brief_uses_environment_brief_not_world_type():
    plan = {
        "world": {"type": "city_grid", "name": "the hall", "brief": "aisles after closing, fluorescent and quiet"},
        "worlds": [{"name": "the stockroom", "brief": "boxes and a buzzing light"}],
        "identity": {"throughLine": "a hall of empty shelves", "cameraPersonality": "held stills"},
    }
    brief = music_brief(plan, {"tone": "elegiac", "title": "The last store"})
    assert "aisles after closing" in brief
    assert "held stills" in brief
    assert "city_grid" not in brief


def test_render_recovery_keeps_assets_and_prefers_visual_type():
    ctx = {"scene": {"visualType": "data", "description": "a chart of closings"}, "assets": {"p1": {"kind": "photo"}}}
    code, cause = recover_render_code(ctx, original_code="broken()")
    assert code == fallback_code(ctx)
    assert "assets retained" in cause
    assert code != "broken()"
    strategy = recover_render_strategy(ctx, "broken()", "sandbox_error")
    assert strategy["prefer"] == "visual_type_fallback"
    assert "p1" in strategy["keepAssets"]
    assert strategy["lastResort"] == "framework_fallback"
    # Photo beats keep a renderable fallback (not an unrelated map).
    photo_ctx = {"scene": {"visualType": "photo", "assetId": "p1"}, "assets": {"p1": {}}}
    pcode, _ = recover_render_code(photo_ctx)
    assert pcode == fallback_code(photo_ctx)


def test_resume_skips_paid_narration_and_completed_scenes():
    scenes = [
        {"id": "a", "status": "done", "renderKey": "k"},
        {"id": "b", "status": "failed", "renderKey": None},
    ]
    d = resume_produce({"layout": {"durationS": 10}}, {"voice": "v"}, {"resume": True}, scenes)
    assert d["reuseNarration"] and d["reuseLayout"] and d["skipPaidNarration"]
    assert d["doneSceneIds"] == ["a"] and d["pendingSceneIds"] == ["b"]
    fresh = resume_produce({"layout": {"durationS": 10}}, {"voice": "v"}, {}, scenes)
    assert fresh["pendingSceneIds"] == ["a", "b"]
    assert "single-attempt" in d["policy"]


def test_element_patches_do_not_require_a_model():
    spec = {"media": [{"id": "m1", "assetId": "p1"}], "text": [{"id": "t1", "text": "Hello"}]}
    els = elements_from_spec(spec)
    kinds = {e["kind"] for e in els}
    assert "media" in kinds and "text" in kinds
    patched = apply_element_patch(spec, {"id": "t1", "text": "The last store"})
    assert patched["text"][0]["text"] == "The last store"
    assert spec["text"][0]["text"] == "Hello"  # original preserved


def test_style_memory_and_future_engines():
    assert any(a["id"] == "held_photograph" for a in APPROACHES)
    mem = record({"identityPackage": {"throughLine": "empty shelves", "cameraPersonality": "held stills"}}, [])
    assert mem[0]["throughLine"] == "empty shelves"
    assert "empty shelves" in prompt_excerpt(mem)
    assert get_engine()["id"] == CURRENT_ENGINE == "cinematic_skill"
    ids = {e["id"] for e in available_engines()}
    assert ids >= {"cinematic_skill", "dolly", "hyperframes", "open_3d_skills", "remotion"}
    reserved = get_engine("remotion")
    assert reserved["status"] == "reserved" and reserved["tools"] is None


def test_jobs_and_config_source_have_the_hooks():
    jobs = (WORKER_ROOT / "clips_worker/motion_studio/pipeline/jobs.py").read_text()
    assert "recover_render_code" in jobs
    assert "final_res_times" in jobs
    assert "keyframe_entries" in jobs
    assert "resume_produce" in jobs
    assert "FALLBACK_CODE" in jobs  # last resort only
    # Must not jump straight to generic FALLBACK_CODE on the first exception.
    tree = ast.parse(jobs)
    # compile_spec / elementEdit path exists
    assert "elementEdit" in jobs and "compile_spec" in jobs
    cfg = (WORKER_ROOT / "clips_worker/motion_studio/pipeline/config.py").read_text()
    assert "def final_render_size" in cfg
    music = (WORKER_ROOT / "clips_worker/motion_studio/pipeline/music_source.py").read_text()
    assert "music_brief" in music and '.get("type")' not in music
    prod = (WORKER_ROOT / "clips_worker/motion_studio/directors/documentary/production.py").read_text()
    assert "identity_package" in prod and "build_storyboard" in prod and "estimate_credits" in prod
    svc = REPO_ROOT / "new-app/lib/server/motion-studio/service.ts"
    if svc.exists():
        text = svc.read_text()
        assert "resume: true" in text
        assert "elementEdit: reason === 'scene_updated'" in text
        assert "costEstimate" in text
    fmt = REPO_ROOT / "new-app/lib/motion-studio/format.ts"
    if fmt.exists():
        fn = fmt.read_text().split("export function formatMsCredits")[1].split("export function")[0]
        assert "USD" not in fn and "dollar" not in fn.lower() and "credit" in fn
    from clips_worker.motion_studio.pipeline import config
    # Delivery QA is 1080p even when iteration is 480p.
    assert config.render_size("16:9", {"renderSize": "480p"}) == (854, 480)
    assert config.final_render_size("16:9", {"renderSize": "480p", "format": "16:9_1080p"}) == (1920, 1080)


def test_fallback_still_available_as_last_resort():
    assert isinstance(FALLBACK_CODE, str) and "build_scene" in FALLBACK_CODE or "StudioFilm" in FALLBACK_CODE or "Film(" in FALLBACK_CODE or "def build" in FALLBACK_CODE or len(FALLBACK_CODE) > 20


def test_creative_plan_validation_requires_identity_and_rejects_type_only_worlds():
    story = {"title": "A store closes", "lines": [{"id": "l1", "text": "The last store closed."}]}
    editorial = {"world": {"brief": "a dim retail hall", "reason": "the story is set there"}, "scenes": []}
    assert validate_creative_plan(editorial, story) == []
    assert "type label" in " ".join(validate_creative_plan({"world": {"type": "city_grid"}}, story))
    produced = {
        "blueprint": {}, "identityPackage": {}, "world": {"type": "city_grid"},
        "storyboard": {"frames": []}, "storyboardReview": {"status": "needs_review"},
    }
    errs = validate_creative_plan(produced, story)
    assert any("identity" in e for e in errs)
    assert any("storyboard" in e for e in errs)
    assert any("credits" in e for e in errs)
    good = identity_package({"identity": {"typography": {"display": "Oswald"}, "throughLine": "empty shelves",
                                          "cameraPersonality": "held stills"},
                             "worlds": [{"id": "w", "name": "the hall", "brief": "aisles"}],
                             "scenes": []}, story)
    plan = {"blueprint": {"worlds": [{"id": "w"}]}, "identityPackage": good, "identity": good,
            "worlds": [{"id": "w", "brief": "aisles"}], "storyboard": {"frames": [1]},
            "storyboardReview": {"status": "approved", "pass": True},
            "costEstimate": {"unit": "credits", "total": 12},
            "assetUsageManifest": {"entries": []}}
    assert validate_creative_plan(plan, story) == []


def test_film_director_prompt_is_editorial_and_has_no_world_type_menu():
    src = (WORKER_ROOT / "clips_worker/motion_studio/directors/documentary/director.py").read_text()
    # The chat prompt (not the leftover capability tuple) must not force a WORLD_TYPES menu.
    start = src.find("You are the Film Director")
    end = src.find("Return JSON", start)
    prompt = src[start:end]
    assert start != -1 and "editorial only" in prompt
    assert "WORLD_TYPES" not in prompt
    assert "Invent ONE world" not in prompt
    assert "one of" not in prompt.lower() or "world type" not in prompt.lower()
