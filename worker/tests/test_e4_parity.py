"""E4 parity: worker mirrors of color.ts / speed.ts / text-items.ts vs the shared fixture
(new-app/tests/e4-parity.test.ts writes / asserts the same JSON)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.color import apply_look, look_for_spec, look_key, video_spec_at_source, write_cube
from clips_worker.speed import (
    atempo_chain,
    normalize_segment_speeds,
    speed_warp_pieces,
    warp_ms,
    warped_duration_ms,
)
from clips_worker.text_items import _px, text_items, text_items_ass

FIX = json.loads((Path(__file__).parent / "fixtures" / "e4_parity.json").read_text())


@pytest.mark.parametrize("i", range(len(FIX["specs"])))
def test_color_look_matches_web(i):
    spec = FIX["specs"][i]
    want = FIX["looks"][i]
    assert look_key(spec) == want["key"]
    look = look_for_spec(spec)
    for px, exp in zip(FIX["pixels"], want["out"]):
        got = apply_look(look, px)
        assert got == pytest.approx(exp, abs=2e-6), (spec, px)


def test_video_spec_resolution_matches_web():
    edits = {"color": FIX["colorEdits"]["edits"]}
    for ms, key in FIX["colorEdits"]["at"]:
        assert look_key(video_spec_at_source(edits, ms)) == key, ms


@pytest.mark.parametrize("case", FIX["speedCases"], ids=lambda c: c["name"])
def test_speed_warp_matches_web(case):
    speeds = normalize_segment_speeds(case["raw"])
    assert speeds == case["speeds"]
    pieces = speed_warp_pieces(case["segs"], speeds)
    assert pieces == case["pieces"]
    assert round(warped_duration_ms(pieces), 3) == pytest.approx(case["durationMs"], abs=1e-3)
    samples = [0, 1, 500, 999, 1000, 1500, 2500, 3000, 3999, 4000, 5000, 6000]
    assert [round(warp_ms(pieces, t), 3) for t in samples] == pytest.approx(case["warp"], abs=1e-3)


def test_atempo_chain_matches_web():
    for s, chain in FIX["atempo"]:
        got = atempo_chain(s)
        assert got == pytest.approx(chain)
        assert all(0.5 <= f <= 2 for f in got)


def test_text_items_and_sizes_match_web():
    items = FIX["text"]["items"]
    assert [t["id"] for t in text_items({"textItems": items})] == [t["id"] for t in items]
    for v, h, px in FIX["textPx"]:
        assert _px(v, h) == pytest.approx(px)


def test_text_ass_static_box_stroke_align():
    items = FIX["text"]["items"]
    ass = text_items_ass({"textItems": items}, w=720, h=1280)
    assert "PlayResX: 720" in ass and "PlayResY: 1280" in ass
    # Item a: Anton 92@1920 → 61 px; stroke 6@1920 → 4 px; left aligned (\an4) at 50%,30%.
    assert "Style: T0,Anton,61,&H0000CCFF,&H0000CCFF,&H00000000,&HFF000000,0,0,0,0,100,100,0,0,1,4.0,0,4," in ass
    # Box: BorderStyle 3, 60 % opacity → alpha 0x66, pad 12@1920 → 8 px, transparent fill.
    assert "Style: B0,Anton,61,&HFF000000,&HFF000000,&H66111111,&HFF000000,0,0,0,0,100,100,0,0,3,8.0,0,4," in ass
    assert r"Dialogue: 1,0:00:00.10,0:00:00.90,T0,,0,0,0,,{\an4\pos(360,384)}HELLO" in ass
    assert r"Dialogue: 0,0:00:00.10,0:00:00.90,B0,,0,0,0,,{\an4\pos(360,384)}HELLO" in ass


def test_text_ass_keyframes_one_event_per_frame():
    items = [{**FIX["text"]["items"][0], "startMs": 0, "endMs": 1000}]
    edits = {"textItems": items, "keyframes": [
        {"target": "text:a", "prop": "x", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 10}]},
    ]}
    ass = text_items_ass(edits, w=1000, h=1000)
    lines = [ln for ln in ass.splitlines() if ln.startswith("Dialogue: 1,")]
    assert len(lines) == 30
    assert r"\pos(500,300)" in lines[0] and r"\pos(597,300)" in lines[-1]


def test_cube_is_identity_for_empty_spec(tmp_path):
    p = write_cube({}, tmp_path / "id.cube", size=3)
    rows = [ln for ln in p.read_text().splitlines() if ln and ln[0].isdigit()]
    assert len(rows) == 27
    assert rows[1] == "0.500000 0.000000 0.000000"  # R varies fastest
