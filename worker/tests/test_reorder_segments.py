import json
from pathlib import Path

import pytest

from clips_worker.caption_words import build_caption_words
from clips_worker.clip_keep_segments import keep_segments, normalize_section_order, ordered_keep_segments

FIXTURE = Path(__file__).resolve().parent / "fixtures/reorder_cases.json"


@pytest.fixture(name="cases")
def _cases():
    return json.loads(FIXTURE.read_text())["cases"]


def _edits(case: dict) -> dict:
    return {
        "v": 2,
        "trim": {"in": case["trimIn"], "out": case["trimOut"]},
        "cutRanges": case.get("cutRanges") or [],
        "sectionOrder": case.get("sectionOrder"),
        "wordFixes": {},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
        "captions": {"enabled": True},
    }


@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text())["cases"], ids=lambda c: c["name"])
def test_reorder_fixture_segments(case):
    if case.get("expectInvalid"):
        assert normalize_section_order(case.get("sectionOrder"), case["trimIn"], case["trimOut"]) is None
        return
    edits = _edits(case)
    segs = ordered_keep_segments(edits)
    assert segs == [tuple(x) for x in case["expectSegments"]]


def test_build_caption_words_sorted_with_reorder():
    case = next(c for c in json.loads(FIXTURE.read_text())["cases"] if c["name"] == "swap_two")
    edits = _edits(case)
    words = [
        {"i": 0, "w": "a", "s": 0.0, "e": 4.0},
        {"i": 1, "w": "b", "s": 5.0, "e": 9.0},
    ]
    cap = build_caption_words(words, edits)
    assert cap[0]["s_ms"] <= cap[1]["s_ms"]
