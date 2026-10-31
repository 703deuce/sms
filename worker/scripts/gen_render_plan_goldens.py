"""EP1: regenerate worker/tests/fixtures/render_plan/*.ass (+ badge_expected.json) from cases.json.

The goldens are the WORKER's bytes; vitest (new-app/tests/ep1-render-plan-parity.test.ts) asserts the
TS builders equal them, pytest (tests/test_render_plan_goldens.py) asserts the worker still emits them.
Run after an intended change to a builder:  python scripts/gen_render_plan_goldens.py
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIX = ROOT / "tests" / "fixtures" / "render_plan"


def render_case(case: dict) -> str | None:
    kind = case["kind"]
    if kind == "captions":
        from clips_worker.captions_ass import build_ass

        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "c.ass"
            build_ass(case["words"], case["captions"], p, play_w=case["w"], play_h=case["h"])
            return p.read_text()
    if kind == "text_items":
        from clips_worker.text_items import text_items_ass

        return text_items_ass(case["edits"], w=case["w"], h=case["h"])
    if kind == "hook":
        from clips_worker.hook_overlay import hook_ass_for_edits

        return hook_ass_for_edits(case["edits"], play_w=case["w"], play_h=case["h"])
    if kind == "title":
        from clips_worker.title_fit import title_ass_content

        return title_ass_content(
            case["text"], play_w=case["w"], play_h=case["h"], rect=case["rect"], kind=case["bgKind"],
            text_color=case["textColor"], font=case["font"], duration_ms=case["durationMs"],
        )
    if kind == "headline":
        from clips_worker.stream_headline_ass import headline_ass_content

        return headline_ass_content(
            case["headline"], play_w=case["w"], play_h=case["h"], bar_h=case["barH"],
            duration_ms=case["durationMs"], bar_y=case.get("barY", 0), fit_top=bool(case.get("fitTop")),
            text_color=case.get("textColor"), headline_style=case.get("headlineStyle"),
            text_box_x=case.get("textBoxX"), text_box_w=case.get("textBoxW"),
        )
    raise ValueError(kind)


def badge_states(cases: list[dict]) -> list[dict]:
    from clips_worker.layers_spec import badge_render_state

    return [
        {"name": c["name"], "state": badge_render_state(c["edits"], template_mode=bool(c.get("templateMode")))}
        for c in cases
    ]


def speed_expected(cases: list[dict]) -> list[dict]:
    from clips_worker.speed import normalize_segment_speeds, speed_warp_pieces, warped_duration_ms

    out = []
    for c in cases:
        pieces = speed_warp_pieces(c["segments"], normalize_segment_speeds(c["speeds"]))
        out.append({"name": c["name"], "pieces": pieces, "outputDurationMs": warped_duration_ms(pieces)})
    return out


def main() -> None:
    cases = json.loads((FIX / "cases.json").read_text())
    for c in cases["ass"]:
        out = render_case(c)
        (FIX / f"{c['name']}.ass").write_text(out if out is not None else "", encoding="utf-8")
    (FIX / "badge_expected.json").write_text(json.dumps(badge_states(cases["badge"]), indent=1) + "\n")
    (FIX / "speed_expected.json").write_text(json.dumps(speed_expected(cases["speed"]), indent=1) + "\n")
    print(f"wrote {len(cases['ass'])} goldens + {len(cases['badge'])} badge states")


if __name__ == "__main__":
    main()
