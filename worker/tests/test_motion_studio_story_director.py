"""Story / Research / Director helpers (no paid calls)."""
from clips_worker.motion_studio.directors.documentary.director import fallback_plan
from clips_worker.motion_studio.directors.documentary.story import (
    backfill_sources,
    default_research_plan,
    _fallback_script,
    _research_key,
)


def test_research_plan_is_grounded_and_deterministic():
    a = default_research_plan("What happened in the GameStop squeeze in January 2021?", "The squeeze")
    b = default_research_plan("What happened in the GameStop squeeze in January 2021?", "The squeeze")
    assert a and a == b
    assert any(q["grounded"] for q in a)
    assert _research_key("brief", "t") == _research_key("brief", "t")
    assert _research_key("brief", "t") != _research_key("other", "t")


def test_fallback_script_uses_research_bullets():
    research = {
        "results": [{
            "query": "facts",
            "text": "- Shares closed at $483 on January 27, 2021.\n- Melvin Capital lost billions.\n- Roaring Kitty's stream drew millions of viewers.\n- The House held a hearing in February.",
            "sources": [{"url": "https://example.com/gme", "title": "ex"}],
            "claims": [],
        }],
        "sources": [{"url": "https://example.com/gme"}],
    }
    story = _fallback_script("the GameStop short squeeze", 1, "The squeeze", research)
    assert story.get("fromResearch")
    texts = " ".join(l["text"] for l in story["lines"])
    assert "483" in texts or "Melvin" in texts
    assert any(l.get("sources") for l in story["lines"])


def test_fallback_script_without_research_stays_template():
    story = _fallback_script("an invented topic with no sources", 1, "Untitled")
    assert story.get("template")
    assert not story.get("fromResearch")


def test_backfill_sources_attaches_urls_to_numeric_lines():
    lines = [
        {"id": "l1", "text": "Shares hit $483 that week.", "spoken": "shares hit four hundred eighty-three dollars that week", "sources": []},
        {"id": "l2", "text": "Nobody saw it coming.", "spoken": "nobody saw it coming", "sources": []},
    ]
    research = {"results": [{"text": "GME hit $483 in January 2021", "sources": [{"url": "https://example.com/a"}], "claims": []}]}
    out = backfill_sources(lines, research)
    assert out[0]["sources"] == ["https://example.com/a"]
    assert out[1]["sources"] == []


def test_director_fallback_invents_a_story_world_brief():
    def story(text, data=None):
        extra = [
            {"id": "l2", "chapter": 1, "text": "Then the people closest to it saw it first.", "hero": "FIRST", "spoken": "then the people closest to it saw it first"},
            {"id": "l3", "chapter": 2, "text": "What they did next changed everything.", "hero": "THE TURN", "spoken": "what they did next changed everything"},
        ]
        return {"title": "t", "tone": "curious",
                "lines": [{"id": "l1", "chapter": 1, "text": text, "hero": "CHICAGO", "spoken": text}, *extra],
                "data": data or []}

    mapped = fallback_plan({"id": "p1"}, story("On the south side of Chicago the border of the city held."), [])
    brief = (mapped["world"].get("brief") or mapped["world"].get("reason") or "").lower()
    assert mapped["world"].get("name")
    assert "place" in brief or "location" in brief
    assert mapped["world"].get("type") not in {"map", "city_grid", "price_chart"}
    # Do not overwrite scene visualTypes to match a world menu.
    assert mapped["scenes"][0]["visualType"] == "title"

    chart = fallback_plan({"id": "p2"}, story("Then the share price and the market came apart.",
                                              data=[{"label": "price", "value": 483, "unit": "USD", "lineId": "l1",
                                                     "provenance": {"origin": "research", "citations": [], "approximate": False}}]), [])
    brief = (chart["world"].get("brief") or chart["world"].get("reason") or "").lower()
    assert "data" in brief or "figure" in brief
    assert chart["world"].get("type") not in {"price_chart", "map", "city_grid"}


def test_web_research_is_off_by_default():
    from clips_worker.motion_studio.directors.documentary.story import _web_research_on
    assert _web_research_on(None) is False
    assert _web_research_on({}) is False
    assert _web_research_on({"webResearch": False}) is False
    assert _web_research_on({"webResearch": "off"}) is False
    assert _web_research_on({"webResearch": True}) is True
    assert _web_research_on({"webResearch": "true"}) is True


def test_web_research_off_skips_grounded_calls(monkeypatch):
    from clips_worker.motion_studio.directors.documentary import story as S
    monkeypatch.setattr(S.config, "mock", lambda: False)
    called = []
    monkeypatch.setattr(S, "plan_research", lambda *a, **k: called.append("plan") or [])
    def _write(*a, **k):
        return {"title": "t", "tone": "curious", "chapters": [], "lines": [
            {"id": "l1", "chapter": 1, "text": "Hello.", "spoken": "hello", "hero": "HELLO", "typed": "", "sources": []}
        ], "data": [], "sources": []}
    monkeypatch.setattr(S, "write_from_idea", _write)
    logs = []
    story = S.build_story({"workflow": "idea", "brief": "Blockbuster", "title": "t", "settings": {}}, [], lambda k, m, d=None: logs.append(k))
    assert called == []
    assert "research_skipped" in logs
    assert story["lines"]


def test_web_research_on_runs_grounded_plan(monkeypatch):
    from clips_worker.motion_studio.directors.documentary import story as S
    import clips_worker.motion_studio.directors.documentary.research as R
    monkeypatch.setattr(S.config, "mock", lambda: False)
    called = []
    monkeypatch.setattr(S, "plan_research", lambda *a, **k: called.append("plan") or [{"query": "how many stores", "grounded": True, "reason": "figure"}])
    monkeypatch.setattr(R, "run_research", lambda plan, log: called.append("run") or {"results": [], "decisions": plan, "sources": []})
    monkeypatch.setattr(S, "write_from_idea", lambda *a, **k: {"title": "t", "tone": "curious", "chapters": [], "lines": [
        {"id": "l1", "chapter": 1, "text": "Hello.", "spoken": "hello", "hero": "HELLO", "typed": "", "sources": []}
    ], "data": [], "sources": []})
    S.build_story({"workflow": "idea", "brief": "Blockbuster", "title": "t", "settings": {"webResearch": True}}, [], lambda *a, **k: None)
    assert called == ["plan", "run"]


def test_grounded_http_error_is_a_warning_and_does_not_raise(monkeypatch):
    import io, urllib.error
    from clips_worker.motion_studio.directors.documentary import research as R
    monkeypatch.setattr(R, "_model", lambda: "gemini-2.5-flash")
    monkeypatch.setattr("clips_worker.gemini_vision._key", lambda: "test-key")
    def boom(*a, **k):
        raise urllib.error.HTTPError(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            404,
            "Not Found",
            hdrs=None,
            fp=io.BytesIO(b'{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash","status":"NOT_FOUND"}}'),
        )
    # First call (2.5) 404s; retry to 3.8 also 404s in this test so run_research must swallow it.
    monkeypatch.setattr(urllib.request, "urlopen", boom)
    logs = []
    out = R.run_research([{"query": "how many Blockbuster stores", "grounded": True, "reason": "figure"}],
                         lambda k, m, d=None: logs.append((k, m, d)))
    assert out["results"] == []
    kinds = [k for k, _, _ in logs]
    assert "research_warning" in kinds
    assert "research_failed" not in kinds
    warn = next(m for k, m, _ in logs if k == "research_warning")
    assert "404" in warn
    assert "model knowledge" in warn.lower()


def test_extract_lines_accepts_alternate_shapes():
    from clips_worker.motion_studio.directors.documentary.story import _extract_lines, _finalize
    rows = _finalize(_extract_lines({"script": [{"narration": "Blockbuster opened in Dallas.", "hero": "DALLAS"}]}))
    assert len(rows) == 1 and rows[0]["text"].startswith("Blockbuster")
    rows = _finalize(_extract_lines({"story": {"lines": ["The last store is in Bend, Oregon."]}}))
    assert len(rows) == 1


def test_write_from_idea_prompt_still_writes_without_research():
    from clips_worker.motion_studio.directors.documentary.story import write_from_idea
    src = write_from_idea.__code__
    # The source of the prompt is in the function; load from module file instead.
    import inspect
    import clips_worker.motion_studio.directors.documentary.story as S
    text = inspect.getsource(write_from_idea) + S.WRITING_RULES
    assert "Never return an empty lines list" in text
    assert "research notes are empty" in text
    assert "Every numeric line must cite a research URL" not in text
    assert "Every factual claim must cite at least one source URL" not in text


def test_generic_fallback_does_not_pad_by_repeating():
    from clips_worker.motion_studio.directors.documentary.story import _fallback_script
    story = _fallback_script("How Blockbuster Video went from 9,000 stores to one, and the Netflix deal it turned down in 2000.", 3, "Blockbuster")
    texts = [l["text"] for l in story["lines"]]
    assert story.get("template")
    assert len(texts) == len(set(texts)), texts
    assert any("Blockbuster" in t for t in texts)


def test_fallback_plan_assigns_every_upload_and_plays_clips_in_full():
    from clips_worker.motion_studio.directors.documentary.director import fallback_plan, validate_plan
    story = {"title": "A shop on the corner", "tone": "curious", "lines": [
        {"id": "l1", "chapter": 1, "text": "A shop stood on the corner for years.", "hero": "THE SHOP", "spoken": "a shop stood on the corner for years"},
        {"id": "l2", "chapter": 1, "text": "Inside, the shelves were still full.", "hero": "SHELVES", "spoken": "inside the shelves were still full"},
        {"id": "l3", "chapter": 1, "text": "A sign out front kept the name alive.", "hero": "THE SIGN", "spoken": "a sign out front kept the name alive"},
        {"id": "l4", "chapter": 2, "text": "Mailers arrived in envelopes each week.", "hero": "THE MAILERS", "spoken": "mailers arrived in envelopes each week"},
        {"id": "l5", "chapter": 2, "text": "Then a mechanism loaded a tape.", "hero": "THE TAPE", "spoken": "then a mechanism loaded a tape"},
        {"id": "l6", "chapter": 2, "text": "What happened next was a different era.", "hero": "THE TURN", "spoken": "what happened next was a different era"},
    ]}
    catalog = [
        {"id": "img_ext", "kind": "image", "filename": "shop_exterior.jpg",
         "analysis": {"summary": "shop stood on the corner exterior", "tags": ["storefront", "shop"]}, "status": "ready"},
        {"id": "img_int", "kind": "image", "filename": "shop_interior.jpg",
         "analysis": {"summary": "inside shelves still full", "tags": ["interior", "shelves"]}, "status": "ready"},
        {"id": "img_sign", "kind": "image", "filename": "shop_sign.jpg",
         "analysis": {"summary": "a sign out front", "tags": ["sign"]}, "status": "ready"},
        {"id": "img_mail", "kind": "image", "filename": "mailer_envelope.jpg",
         "analysis": {"summary": "mailers arrived in envelopes", "tags": ["envelope", "mail"]}, "status": "ready"},
        {"id": "img_logo", "kind": "image", "filename": "brand_logo.png",
         "analysis": {"summary": "company wordmark", "tags": ["logo", "wordmark"]}, "status": "ready"},
        {"id": "vid_mech", "kind": "video", "filename": "tape_load_mechanism.mp4", "durationMs": 12667,
         "analysis": {"summary": "mechanism loaded a tape", "moments": [{"inS": 0, "outS": 12.667}]}, "status": "ready"},
    ]
    plan = fallback_plan({"id": "p-alloc"}, story, catalog)
    errs = validate_plan(plan, story, catalog)
    assert errs == [], errs
    assigned = set()
    for s in plan["scenes"]:
        if s.get("assetId"):
            assigned.add(s["assetId"])
        if (s.get("handoff") or {}).get("assetId"):
            assigned.add(s["handoff"]["assetId"])
    assert assigned == {a["id"] for a in catalog}, assigned
    logo_scenes = [s for s in plan["scenes"] if s.get("assetId") == "img_logo"]
    assert logo_scenes, "logo/wordmark must be assigned"
    assert any(s.get("visualType") == "title" or s is plan["scenes"][-1] or s.get("index") == 0 for s in logo_scenes)
    stills = [s.get("assetId") for s in plan["scenes"] if s.get("assetId")]
    assert len(stills) == len(set(stills)), stills
    hand = next(s for s in plan["scenes"] if s.get("kind") == "handoff")
    assert hand["handoff"]["audioMode"] == "clip"
    assert abs(hand["handoff"]["outS"] - 12.667) < 0.02
    assert hand["handoff"]["outS"] > 8.0
    # visualTypes must not all be forced to one world menu value
    vts = {s["visualType"] for s in plan["scenes"] if s.get("kind") == "graphics"}
    assert "title" in vts


def test_validate_plan_rejects_an_unused_upload():
    from clips_worker.motion_studio.directors.documentary.director import fallback_plan, validate_plan
    story = {"title": "t", "lines": [
        {"id": "l1", "chapter": 1, "text": "Hello there friends.", "hero": "HELLO", "spoken": "hello there friends"},
        {"id": "l2", "chapter": 1, "text": "Then everything changed.", "hero": "CHANGE", "spoken": "then everything changed"},
        {"id": "l3", "chapter": 1, "text": "That was the end of it.", "hero": "THE END", "spoken": "that was the end of it"},
    ]}
    catalog = [
        {"id": "used", "kind": "image", "filename": "one.jpg", "analysis": {"summary": "hello friends"}, "status": "ready"},
        {"id": "left", "kind": "image", "filename": "two.jpg", "analysis": {"summary": "unused still"}, "status": "ready"},
    ]
    plan = fallback_plan({"id": "p-unused"}, story, catalog)
    # Strip one assignment to simulate a director miss.
    for s in plan["scenes"]:
        if s.get("assetId") == "left":
            s.pop("assetId", None)
    for pl in (plan.get("blueprint") or {}).get("assetPlacements") or []:
        if pl.get("assetId") == "left":
            pl["assetId"] = None
    errs = validate_plan(plan, story, catalog)
    assert any("two.jpg" in e for e in errs), errs
