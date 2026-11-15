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
