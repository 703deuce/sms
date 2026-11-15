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


def test_director_fallback_invents_a_map_or_chart_world():
    def story(text, data=None):
        extra = [
            {"id": "l2", "chapter": 1, "text": "Then the people closest to it saw it first.", "hero": "FIRST", "spoken": "then the people closest to it saw it first"},
            {"id": "l3", "chapter": 2, "text": "What they did next changed everything.", "hero": "THE TURN", "spoken": "what they did next changed everything"},
        ]
        return {"title": "t", "tone": "curious",
                "lines": [{"id": "l1", "chapter": 1, "text": text, "hero": "CHICAGO", "spoken": text}, *extra],
                "data": data or []}

    mapped = fallback_plan({"id": "p1"}, story("On the south side of Chicago the border of the city held."), [])
    assert mapped["world"]["type"] == "map"
    assert any(s["visualType"] == "map" for s in mapped["scenes"] if s["visualType"] != "title")

    chart = fallback_plan({"id": "p2"}, story("Then the share price and the market came apart.",
                                              data=[{"label": "price", "value": 483, "unit": "USD", "lineId": "l1",
                                                     "provenance": {"origin": "research", "citations": [], "approximate": False}}]), [])
    assert chart["world"]["type"] == "price_chart"
    assert any(s["visualType"] == "data" for s in chart["scenes"] if s["visualType"] != "title")


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
