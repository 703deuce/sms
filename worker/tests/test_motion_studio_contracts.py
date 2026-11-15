"""Output contracts are the single source of truth for prompts, schemas, and validators.

CI: every validator rule must appear in that stage's prompt/schema. The Blockbuster
v2 invalid plan (reconstructed from msp_f06a8ea2221c4c22b4db4a049d8d25c8) is a
regression for the four error classes that slipped through the director prompt.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.motion_studio.core.output_contracts import (
    STAGES,
    StageContractError,
    assert_prompt_covers_rules,
    format_contract,
    normalize_director_plan,
    normalize_palette,
    resolve_asset_id,
    schema_for,
    assert_schemas_are_strict,
    record_invalid_output,
    validate_story,
)
from clips_worker.motion_studio.directors.documentary.director import (
    director_system,
    direct,
    fallback_plan,
    validate_plan,
)
from clips_worker.motion_studio.core.reviewer import review_film

ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "fixtures" / "ms_bb_v2_invalid_director_plan.json"


def _fixture():
    return json.loads(FIXTURE.read_text())


def test_every_validator_rule_is_represented_in_its_stage_prompt_and_schema():
    prompts = {
        "director": director_system(),
        "production_designer": format_contract("production_designer"),
        "story": format_contract("story"),
        "motion_engineer": format_contract("motion_engineer") + (
            ROOT.parents[0] / "clips_worker/motion_studio/directors/documentary/engineer.py"
        ).read_text() + (
            ROOT.parents[0] / "clips_worker/motion_studio/core/craft.py"
        ).read_text(),
        "reviewer": format_contract("reviewer") + Path(
            ROOT.parents[0] / "clips_worker/motion_studio/core/reviewer.py"
        ).read_text(),
        "production_revision": format_contract("production_revision"),
    }
    missing = []
    for stage in STAGES:
        assert f"OUTPUT CONTRACT for {stage}" in prompts[stage] or stage != "director" or "OUTPUT CONTRACT for director" in prompts["director"]
        missing.extend(assert_prompt_covers_rules(stage, prompts[stage], schema_for(stage)))
    # Live call sites must actually include the generated contract (not just the helper).
    director_src = (ROOT.parents[0] / "clips_worker/motion_studio/directors/documentary/director.py").read_text()
    production_src = (ROOT.parents[0] / "clips_worker/motion_studio/directors/documentary/production.py").read_text()
    story_src = (ROOT.parents[0] / "clips_worker/motion_studio/directors/documentary/story.py").read_text()
    jobs_src = (ROOT.parents[0] / "clips_worker/motion_studio/pipeline/jobs.py").read_text()
    assert "format_contract(\"director\")" in director_src or "OUTPUT CONTRACT for director" in director_system()
    assert "format_contract(\"production_designer\")" in production_src
    assert "format_contract(\"production_revision\")" in production_src
    assert "format_contract(\"story\")" in story_src
    assert "run_preflight" in jobs_src
    assert "revise_limited_scenes" in jobs_src
    assert "skipPreflight" in jobs_src
    if missing:
        pytest.fail("validator rules missing from prompt/schema:\\n" + "\\n".join(missing))


def test_director_system_includes_palette_handoff_upload_and_reuse_rules():
    prompt = director_system().lower()
    for tok in ("bg", "ink", "accent", "accent2", "muted", "#rrggbb", "reusereason", "handoff.assetid", "every ready upload"):
        assert tok in prompt, tok


def test_bb_v2_invalid_plan_reproduces_the_recorded_error_classes():
    doc = _fixture()
    errs = validate_plan(doc["plan"], doc["story"], doc["catalog"])
    for expected in doc["expectedErrors"]:
        assert expected in errs, expected
    assert len(errs) == len(doc["expectedErrors"])


def test_normalize_does_not_invent_a_palette_or_hide_the_bb_v2_errors():
    doc = _fixture()
    plan = normalize_director_plan(json.loads(json.dumps(doc["plan"])), doc["catalog"])
    errs = validate_plan(plan, doc["story"], doc["catalog"])
    for expected in doc["expectedErrors"]:
        assert expected in errs, expected


def test_normalize_coerces_hex_and_resolves_handoff_filenames():
    pal = normalize_palette({"background": "0d1018", "ink": "#fff", "accent": "#ffc400", "accent2": "#5ac8ff", "muted": "#7a8296"})
    assert pal["bg"] == "#0d1018"
    assert pal["ink"] == "#ffffff"
    catalog = [{"id": "msa_vid", "filename": "clip.mp4", "kind": "video", "durationMs": 30000, "status": "ready"}]
    assert resolve_asset_id("clip.mp4", catalog) == "msa_vid"
    plan = {
        "world": {"brief": "b", "reason": "r", "name": "n"},
        "style": {"palette": pal, "mood": "m", "reason": "r",
                  "fonts": {"display": "cond", "label": "label", "body": "serif"}},
        "music": {"mood": "m", "brief": "a short bed", "reason": "matches the tone"},
        "scenes": [{
            "index": 0, "kind": "handoff", "visualType": "handoff", "lineIds": [], "description": "c",
            "emphasis": [], "reason": "play the clip", "transitionOut": "handoff",
            "handoff": {"assetId": "clip.mp4", "inS": 0, "outS": 30, "audioMode": "clip", "surface": "photo"},
        }],
    }
    out = normalize_director_plan(plan, catalog)
    assert out["scenes"][0]["handoff"]["assetId"] == "msa_vid"
    assert validate_plan(out, {"title": "t", "lines": []}, catalog) == []


def test_direct_repair_is_a_backstop_and_does_not_silently_fallback(monkeypatch):
    doc = _fixture()
    from clips_worker.motion_studio.pipeline import config, llm
    monkeypatch.setattr(config, "mock", lambda: False)
    calls = []

    valid = fallback_plan({"id": "p-repair"}, doc["story"], doc["catalog"])

    def fake_chat(step, system, user, *, max_tokens=0, schema=None, schema_name=None, **_kw):
        calls.append({"schema_name": schema_name, "user": user, "system_has_contract": "OUTPUT CONTRACT for director" in system})
        if len(calls) == 1:
            return json.loads(json.dumps(doc["plan"])), {"ok": True, "step": "director"}
        # Targeted repair: the second call is fed the exact validator errors.
        assert "errors" in user
        assert "style.palette needs bg/ink/accent/accent2/muted hex colours" in user
        return json.loads(json.dumps(valid)), {"ok": True, "step": "director"}

    monkeypatch.setattr(llm, "chat_json", fake_chat)
    import clips_worker.motion_studio.directors.documentary.director as director_mod
    monkeypatch.setattr(director_mod, "chat_json", fake_chat)

    logs = []
    plan = direct({"id": "p-repair", "settings": {}}, doc["story"], doc["catalog"], lambda k, m, d=None: logs.append((k, m)))
    assert plan["source"] == "model_repaired"
    assert validate_plan(plan, doc["story"], doc["catalog"]) == []
    assert len(calls) == 2
    assert calls[0]["schema_name"] == "director_plan"
    assert calls[0]["system_has_contract"]
    assert any(k == "plan_invalid" for k, _ in logs)


def test_direct_stops_instead_of_shipping_a_fallback_plan(monkeypatch):
    doc = _fixture()
    from clips_worker.motion_studio.pipeline import config
    import clips_worker.motion_studio.directors.documentary.director as director_mod
    monkeypatch.setattr(config, "mock", lambda: False)

    def fake_chat(step, system, user, *, max_tokens=0, schema=None, schema_name=None, **_kw):
        return json.loads(json.dumps(doc["plan"])), {"ok": True, "step": "director"}

    monkeypatch.setattr(director_mod, "chat_json", fake_chat)
    with pytest.raises(StageContractError) as ei:
        direct({"id": "p-fail", "settings": {}}, doc["story"], doc["catalog"], lambda *a, **k: None)
    err = ei.value
    assert err.stage == "director"
    assert err.repaired is True
    assert any("style.palette" in e for e in err.errors)
    assert "without a reuseReason" in str(err)
    assert "missing video asset" in str(err)
    assert "is not assigned" in str(err)


def test_preflight_fails_loudly_and_does_not_enqueue(monkeypatch):
    from clips_worker.motion_studio.pipeline.preflight import run_preflight
    from clips_worker.motion_studio.core.output_contracts import StageContractError as Err

    class FakeConn:
        pass

    events = []

    def log(kind, message, data=None):
        events.append((kind, message))

    # Minimal stubs: story/plan fail contract, so we never reach design/enqueue.
    proj = {"id": "p-pre", "story": {}, "plan": {"source": "fallback"}, "qa": {}}
    raised = False
    try:
        # db.assets will fail without a real conn; stub it.
        run_preflight(
            FakeConn(), proj, "/tmp", log,
            prepare_photos=None, assets_dir=None, scratch_dir_fn=None,
            scene_context_fn=None, render_hash_fn=None, upload_file=None,
            work_key="k", design_scene=None, exec_log=None, catalog=[],
        )
    except Err as exc:
        raised = True
        assert exc.stage == "preflight"
        assert exc.errors
    assert raised
    assert any(k == "preflight_failed" for k, _ in events)


def test_reviewer_reports_degraded_scenes_with_the_exact_cause():
    scenes = [{"index": 2, "usedFallback": True, "qa": {"degraded": True, "degradeCause": "style.palette needs bg/ink/accent/accent2/muted hex colours"}}]
    out = review_film(scenes=scenes, checks=[])
    assert out["pass"] is False
    details = [i.get("detail") for i in out["issues"]]
    assert any("style.palette" in str(d) for d in details)


def test_every_stage_schema_is_openai_strict():
    problems = assert_schemas_are_strict()
    assert problems == [], "strict json_schema problems:\n" + "\n".join(problems)
    pal = schema_for("director")["properties"]["style"]["properties"]["palette"]["properties"]["bg"]
    assert pal.get("pattern") == "^#[0-9A-Fa-f]{6}$"
    args = schema_for("motion_engineer")["properties"]["tools"]["items"]["properties"]["arguments"]
    assert args == {"type": "string"}


def test_invalid_output_is_persisted_on_the_qa_record():
    qa = record_invalid_output({}, stage="director", errors=["style.palette needs bg/ink/accent/accent2/muted hex colours"],
                               output={"style": {"palette": {}}}, repaired=False)
    stored = qa["invalidOutputs"]
    assert len(stored) == 1
    assert stored[0]["output"]["style"]["palette"] == {}
    assert stored[0]["stage"] == "director"
    qa2 = record_invalid_output(qa, stage="director", errors=stored[0]["errors"], output={"style": {"palette": {}}},
                                repaired=False)
    assert len(qa2["invalidOutputs"]) == 1  # same failure is not duplicated


def test_jobs_source_has_preflight_only_and_persists_invalid_output():
    from pathlib import Path as P
    jobs = (P(__file__).resolve().parents[1] / "clips_worker/motion_studio/pipeline/jobs.py").read_text()
    assert "preflightOnly" in jobs
    assert "preflight_only" in jobs
    assert "record_invalid_output" in jobs
    assert "status=\"preflight_ok\"" in jobs or 'status="preflight_ok"' in jobs
    assert "MGD_RENDER_SEGMENT" in jobs
    # Dry-run must return before enqueue.
    assert "render was not started" in jobs


def _shop_catalog():
    return [
        {"id": "photo_7", "kind": "image", "filename": "shop.jpg", "status": "ready",
         "analysis": {"summary": "a shop front with a lit OPEN neon sign",
                      "onScreenText": ["OPEN"], "tags": ["shop", "storefront"]}},
        {"id": "clip_1", "kind": "video", "filename": "aisle.mp4", "status": "ready", "durationMs": 12000,
         "analysis": {"summary": "quiet aisles", "transcriptText": "the shelves are empty",
                      "tags": ["aisle"]}},
        {"id": "wish_9", "kind": "video", "filename": "parade.mp4", "status": "requested",
         "analysis": {"summary": "not actually acquired"}},
    ]


def test_assets_in_hand_excludes_requested_and_missing():
    from clips_worker.motion_studio.core.designer_capabilities import assets_in_hand, catalog_records
    hand = assets_in_hand(_shop_catalog())
    assert {a["id"] for a in hand} == {"photo_7", "clip_1"}
    blob = str(catalog_records(_shop_catalog()))
    assert "OPEN" in blob and "the shelves are empty" in blob
    assert "localPath" not in blob and "watchModel" not in blob
    assert "wish_9" not in {r["assetId"] for r in catalog_records(_shop_catalog())}


def test_story_is_built_from_assets_in_hand_and_rejects_invented_claims():
    catalog = _shop_catalog()
    ok = {
        "title": "The last shop",
        "chapters": [{"n": 1, "title": "The shop"}],
        "lines": [
            {"id": "l1", "chapter": 1, "text": 'The shop sign reads "OPEN".', "visualAssetId": "photo_7"},
            {"id": "l2", "chapter": 1, "text": "The aisles go quiet.", "visualAssetId": "clip_1"},
            {"id": "l3", "chapter": 1, "text": "A map of nearby streets fills in.", "illustrative": True,
             "provenance": "illustrative map from registered tools"},
        ],
        "missingAssets": [{"need": "a clip of the street parade", "reason": "requested but not in hand"}],
    }
    assert validate_story(ok, catalog=catalog) == []
    bad = {
        "title": "The last shop",
        "chapters": [{"n": 1, "title": "The shop"}],
        "lines": [
            {"id": "l1", "chapter": 1, "text": 'The kiosk screen reads "Out Of Service".', "visualAssetId": "photo_7"},
            {"id": "l2", "chapter": 1, "text": "The parade starts.", "visualAssetId": "wish_9"},
        ],
    }
    errs = validate_story(bad, catalog=catalog)
    assert any("Out Of Service" in e for e in errs)
    assert any("wish_9" in e and "not in hand" in e for e in errs)
    assert any("aisle.mp4" in e or "clip_1" in e for e in errs)


def test_validate_plan_rejects_objective_that_contradicts_asset_analysis():
    from clips_worker.motion_studio.directors.documentary.director import validate_plan
    catalog = _shop_catalog()
    story = {
        "title": "The last shop",
        "lines": [
            {"id": "l1", "chapter": 1, "text": 'The shop sign reads "OPEN".', "visualAssetId": "photo_7"},
            {"id": "l2", "chapter": 1, "text": "The aisles go quiet.", "visualAssetId": "clip_1"},
        ],
        "chapters": [{"n": 1, "title": "The shop"}],
    }
    plan = {
        "source": "model",
        "style": {"palette": {"bg": "#111111", "ink": "#eeeeee", "accent": "#ffcc00", "accent2": "#00aaff", "muted": "#888888"},
                  "fonts": {"display": "Display", "label": "Label", "body": "Body"}, "reason": "this shop"},
        "music": {"mood": "hushed", "brief": "sparse piano", "reason": "let the shop sit"},
        "world": {"brief": "the shop floor", "reason": "the story lives here", "name": "shop"},
        "scenes": [
            {"index": 0, "kind": "graphics", "visualType": "photo", "lineIds": ["l1"],
             "description": 'The kiosk is made to read "Out Of Service".',
             "reason": "wrong", "assetId": "photo_7", "transitionOut": "cut"},
            {"index": 1, "kind": "handoff", "visualType": "handoff", "lineIds": ["l2"],
             "description": "Play the aisle clip.", "reason": "the official footage",
             "handoff": {"assetId": "clip_1", "inS": 0, "outS": 12, "audioMode": "clip", "surface": "photo"},
             "transitionOut": "cut"},
        ],
    }
    errs = validate_plan(plan, story, catalog)
    assert any("Out Of Service" in e for e in errs)


def _pf_proj(tmp_path):
    catalog = [
        {"id": "photo_7", "kind": "image", "filename": "shop.jpg", "status": "ready",
         "analysis": {"summary": "a shop front with a lit OPEN neon sign", "onScreenText": ["OPEN"]}},
    ]
    story = {
        "title": "The last shop",
        "chapters": [{"n": 1, "title": "The shop"}],
        "lines": [{"id": "l1", "chapter": 1, "text": 'The shop sign reads "OPEN".', "spoken": "the shop sign reads open",
                   "hero": "OPEN", "visualAssetId": "photo_7"}],
    }
    plan = {
        "source": "model", "productionSource": "model",
        "style": {"palette": {"bg": "#111111", "ink": "#eeeeee", "accent": "#ffcc00", "accent2": "#00aaff", "muted": "#888888"},
                  "fonts": {"display": "Display", "label": "Label", "body": "Body"}, "reason": "this shop"},
        "music": {"mood": "hushed", "brief": "sparse piano", "reason": "let the shop sit"},
        "world": {"brief": "the shop floor", "reason": "the story lives here", "name": "shop"},
        "scenes": [{"index": 0, "kind": "graphics", "visualType": "photo", "lineIds": ["l1"],
                    "description": 'Hold the shop front, the sign reading "OPEN".',
                    "reason": "the official still shows the open sign", "assetId": "photo_7", "transitionOut": "cut"}],
        "layout": {"scenes": [{"index": 0, "kind": "graphics", "visualType": "photo", "startS": 0, "endS": 4}]},
        "blueprint": {
            "identity": {"typography": "bold sans", "concept": "held storefront", "cameraPersonality": "still"},
            "worlds": [{"id": "w1", "name": "shop", "brief": "the floor", "reason": "this story"}],
            "cameraRoute": "hold the still", "cameraRouteReason": "the photograph is the point",
            "audioDirection": "quiet", "audioDirectionReason": "let the photo sit",
            "sceneBindings": [{"sceneIndex": 0, "assetId": "photo_7",
                               "objective": 'Hold the shop front, the sign reading "OPEN".',
                               "evidenceBasis": "onScreenText includes OPEN", "toolBasis": "place_media PhotoFrame hold"}],
        },
    }
    proj = {"id": "p-rev", "story": story, "plan": plan, "qa": {}}
    return proj, catalog, story, plan


class _FakeDB:
    def __init__(self):
        self.rows = [{"id": "s0", "index": 0}]
        self.plan = None
        self.updated = []

    def scenes(self, conn, pid):
        return self.rows

    def update_scene(self, *a, **k):
        self.updated.append(k)

    def update_project(self, conn, pid, **fields):
        self.plan = fields.get("plan")


def test_preflight_revises_limited_scenes_then_retries_green(monkeypatch, tmp_path):
    from clips_worker.motion_studio.pipeline import preflight as pf
    from clips_worker.motion_studio.core.output_contracts import StageContractError as Err

    fake = _FakeDB()
    proj, catalog, story, plan = _pf_proj(tmp_path)
    calls = {"n": 0}

    def design_scene(ctx, sdir, ad, log, exec_log, preflight=False):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"verdict": "limitation", "degraded": True,
                    "limitation": {"reason": "tools can only fade the whole image, not each letter",
                                   "missingTools": ["per-letter fade"], "missingAssets": [],
                                   "unblock": "use a whole-image hold"}}
        return {"code": "from motion_core import *\n\ndef build_scene(ctx):\n    return None\n",
                "verdict": "preflight", "codeHash": "abc"}

    def revise(project, story, catalog, plan, limitations, log):
        assert [x["sceneIndex"] for x in limitations] == [0]
        plan["scenes"][0]["description"] = 'Hold the shop front, the sign reading "OPEN".'
        return plan

    events = []
    work = str(tmp_path)
    report = pf.run_preflight(
        object(), proj, work, lambda k, m, d=None: events.append(k),
        prepare_photos=lambda *a, **k: {}, assets_dir=lambda w: w,
        scratch_dir_fn=lambda p: work, scene_context_fn=lambda *a, **k: {"index": 0},
        render_hash_fn=lambda ctx: "h", upload_file=lambda *a, **k: None,
        work_key="k", design_scene=design_scene, exec_log=lambda *a, **k: None,
        catalog=catalog, validate_plan=lambda *a, **k: [], validate_blueprint=lambda *a, **k: [],
        revise_limited_scenes=revise, db_mod=fake,
    )
    assert report["ok"] is True
    assert report["productionRevisions"] == 1
    assert report["revisedScenes"] == [0]
    assert calls["n"] == 2
    assert "preflight_revision" in events
    assert "preflight_ok" in events
    assert fake.updated  # code persisted after retry


def test_preflight_fails_loudly_if_revision_still_limited(monkeypatch, tmp_path):
    from clips_worker.motion_studio.pipeline import preflight as pf
    from clips_worker.motion_studio.core.output_contracts import StageContractError as Err

    fake = _FakeDB()
    proj, catalog, story, plan = _pf_proj(tmp_path)

    def design_scene(ctx, sdir, ad, log, exec_log, preflight=False):
        return {"verdict": "limitation", "degraded": True,
                "limitation": {"reason": "still cannot fade each letter",
                               "missingTools": ["per-letter fade"], "missingAssets": [], "unblock": "hold"}}

    def revise(project, story, catalog, plan, limitations, log):
        return plan

    with pytest.raises(Err) as ei:
        pf.run_preflight(
            object(), proj, str(tmp_path), lambda *a, **k: None,
            prepare_photos=lambda *a, **k: {}, assets_dir=lambda w: w,
            scratch_dir_fn=lambda p: str(tmp_path), scene_context_fn=lambda *a, **k: {"index": 0},
            render_hash_fn=lambda ctx: "h", upload_file=lambda *a, **k: None,
            work_key="k", design_scene=design_scene, exec_log=lambda *a, **k: None,
            catalog=catalog, validate_plan=lambda *a, **k: [], validate_blueprint=lambda *a, **k: [],
            revise_limited_scenes=revise, db_mod=fake,
        )
    assert ei.value.stage == "preflight"
    assert any("still cannot fade each letter" in e for e in ei.value.errors)
