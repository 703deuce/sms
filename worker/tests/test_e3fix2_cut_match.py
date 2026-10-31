"""E3fix2: cut transitions match the nearest cut within half a frame (was |Δ| <= 1 ms).

fixtures/cut_match_parity.json is asserted by new-app/tests/e3fix2-cut-match.test.ts too.
Regenerate: WRITE_CUT_MATCH_FIXTURE=1 python -m pytest -q tests/test_e3fix2_cut_match.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from clips_worker.motion import cut_match_tolerance_ms, cut_transition_windows, match_transitions_to_cuts

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "cut_match_parity.json"
SEGS = [(0, 4860), (5140, 6140), (6820, 8140), (8660, 40500)]


def _tr(src: float, t: str = "push_left", d: int = 500) -> dict:
    return {"srcMs": src, "type": t, "durMs": d}


CASES = [
    {"id": "exact", "fps": 30, "segs": SEGS, "transitions": [_tr(5140)]},
    {"id": "off_by_5ms_now_matches", "fps": 30, "segs": SEGS, "transitions": [_tr(5145)]},
    {"id": "off_by_16ms_inside_half_frame", "fps": 30, "segs": SEGS, "transitions": [_tr(6804)]},
    {"id": "off_by_17ms_outside_half_frame", "fps": 30, "segs": SEGS, "transitions": [_tr(6837)]},
    {"id": "fps25_off_by_20ms", "fps": 25, "segs": SEGS, "transitions": [_tr(8680, "crossfade")]},
    {"id": "duplicate_keeps_nearest", "fps": 30, "segs": SEGS, "transitions": [_tr(5150, "wipe_left"), _tr(5141, "dip_black")]},
    {"id": "all_three_cuts", "fps": 30, "segs": SEGS,
     "transitions": [_tr(8660, "zoom_in"), _tr(5139, "push_left"), _tr(6821, "crossfade", 300)]},
    {"id": "first_segment_start_is_not_a_cut", "fps": 30, "segs": SEGS, "transitions": [_tr(3)]},
]


def _windows(c: dict) -> list[dict]:
    return [
        {"k": w["k"], "srcMs": w["srcMs"], "type": w["type"], "startFrame": w["startFrame"], "frames": w["frames"]}
        for w in cut_transition_windows([tuple(s) for s in c["segs"]], c["transitions"], c["fps"])
    ]


def test_tolerance_is_half_a_frame():
    assert abs(cut_match_tolerance_ms(30) - 16.6667) < 1e-3
    assert cut_match_tolerance_ms(25) == 20.0


def test_cases_and_fixture():
    data = {"cases": [{**c, "segs": [list(s) for s in c["segs"]], "expected": _windows(c)} for c in CASES]}
    if os.environ.get("WRITE_CUT_MATCH_FIXTURE"):
        FIXTURE.write_text(json.dumps(data, indent=1) + "\n")
    fixture = json.loads(FIXTURE.read_text())
    assert fixture == json.loads(json.dumps(data))
    by = {c["id"]: c["expected"] for c in data["cases"]}
    assert [w["srcMs"] for w in by["exact"]] == [5140]
    assert [w["srcMs"] for w in by["off_by_5ms_now_matches"]] == [5140]  # dropped before E3fix2
    assert [w["srcMs"] for w in by["off_by_16ms_inside_half_frame"]] == [6820]
    assert by["off_by_17ms_outside_half_frame"] == []
    assert [w["type"] for w in by["fps25_off_by_20ms"]] == ["crossfade"]
    assert [w["type"] for w in by["duplicate_keeps_nearest"]] == ["dip_black"]
    assert [w["srcMs"] for w in by["all_three_cuts"]] == [5140, 6820, 8660]
    assert by["first_segment_start_is_not_a_cut"] == []


def test_unmatched_and_duplicate_are_logged(capsys):
    match_transitions_to_cuts(SEGS, [{"srcMs": 6837, "type": "wipe_left", "durMs": 500}], 30)
    out = capsys.readouterr().out
    assert "[motion] warning transition_unmatched srcMs=6837" in out and "nearest_cut_ms=6820" in out
    match_transitions_to_cuts(SEGS, [_tr(5150), _tr(5141)], 30)
    assert "transition_duplicate srcMs=5150" in capsys.readouterr().out
    match_transitions_to_cuts(SEGS, [_tr(5140)], 30)
    assert capsys.readouterr().out == ""
