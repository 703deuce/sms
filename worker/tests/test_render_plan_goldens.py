"""EP1 Tier A (worker side): the worker's ASS builders still emit the render-plan goldens.

The same goldens are asserted against the TS builders by new-app/tests/ep1-render-plan-parity.test.ts,
so preview (EP2: libass-wasm on the TS bytes) and export burn identical scripts. After an intended
builder change: python scripts/gen_render_plan_goldens.py (and commit the .ass diff).
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

FIX = Path(__file__).resolve().parent / "fixtures" / "render_plan"
_GEN = Path(__file__).resolve().parent.parent / "scripts" / "gen_render_plan_goldens.py"
_spec = importlib.util.spec_from_file_location("gen_render_plan_goldens", _GEN)
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)
CASES = json.loads((FIX / "cases.json").read_text())


@pytest.mark.parametrize("case", CASES["ass"], ids=lambda c: c["name"])
def test_worker_ass_equals_golden(case):
    want = (FIX / f"{case['name']}.ass").read_text(encoding="utf-8")
    assert (gen.render_case(case) or "") == want


def test_badge_rule_matches_fixture():
    want = json.loads((FIX / "badge_expected.json").read_text())
    assert gen.badge_states(CASES["badge"]) == want


def test_ludwig_badge_is_drawn_in_template_mode():
    # clip_fc4ac0ba… (read-only SELECT 2026-10-31): badge layer showLabel, handle 2xrakai, T6 template.
    st = {s["name"]: s["state"] for s in json.loads((FIX / "badge_expected.json").read_text())}
    assert st["ludwig_clip_fc4ac0ba"]["on"] and st["ludwig_clip_fc4ac0ba"]["text"] == "2XRAKAI"


def test_speed_expected_matches_worker():
    assert gen.speed_expected(CASES["speed"]) == json.loads((FIX / "speed_expected.json").read_text())


def test_title_fit_measured_two_lines_for_ludwig():
    from clips_worker.title_fit import fit_title

    lines, fs = fit_title("LET'S JUST DIP—VALORANT ISN'T WORTH IT", "Anton", 950, 384)
    assert lines == ["LET'S JUST DIP—VALORANT", "ISN'T WORTH IT"]
    assert 100 <= fs <= 160
    one, fs1 = fit_title("HE QUIT", "Anton", 950, 384)
    assert one == ["HE QUIT"] and fs1 >= fs


def test_text_fonts_are_canonical_libass_names():
    from clips_worker.text_items import TEXT_FONTS

    assert TEXT_FONTS["Montserrat"] == "Montserrat Black"
    assert TEXT_FONTS["Poppins"] == "Poppins ExtraBold"
