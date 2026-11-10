"""G3afix (live check of G3a / PR 832): out-slide direction, SRT/VTT multi-line cues + <i>/<b>."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.caption_lines import (
    build_line_srt,
    caption_line_render_words,
    caption_line_words,
    line_tokens,
    normalize_caption_lines,
    serialize_tokens,
)
from clips_worker.captions_ass import _chunk_fit, build_ass, chunk_words, disp_words, forced_breaks
from clips_worker.text_anim import OUT_MOTION, block_state, frame_anim, norm_anim

FIX = Path(__file__).parent / "fixtures" / "render_plan"


# ---- 1. out slides move the way they are named ----------------------------------------------


@pytest.mark.parametrize(
    "typ,axis,sign",
    [("slide_up", "dy", -1), ("slide_down", "dy", 1), ("slide_left", "dx", -1), ("slide_right", "dx", 1)],
)
def test_out_slide_exits_in_its_named_direction(typ, axis, sign):
    anim = norm_anim({"out": {"type": typ, "durMs": 400}})
    near_end = frame_anim(anim, 1990, 0, 2000, 0, 400)  # 10 ms before the end
    mid = frame_anim(anim, 1800, 0, 2000, 0, 400)
    assert near_end[axis] * sign > mid[axis] * sign > 0
    # in-slides: the same name = the direction it travels while entering (comes from the opposite side)
    a_in = norm_anim({"in": {"type": typ, "durMs": 400}})
    start = frame_anim(a_in, 10, 0, 2000, 400, 0)
    assert start[axis] * sign < 0


def test_out_motion_is_the_mirror_and_non_slides_unchanged():
    assert OUT_MOTION == {"slide_up": "slide_down", "slide_down": "slide_up", "slide_left": "slide_right", "slide_right": "slide_left"}
    for typ in ("fade", "pop", "zoom", "typewriter"):
        a = norm_anim({"out": {"type": typ, "durMs": 400}})
        if a and a.get("out"):
            got = frame_anim(a, 1900, 0, 2000, 0, 400)
            b = block_state(typ, 100 / 400)
            assert (got["dx"], got["dy"]) == (b["dx"], b["dy"])


# ---- 2. multi-line cues and <i>/<b> --------------------------------------------------------


def test_rich_caption_lines_match_fixture():
    exp = json.loads((FIX / "caption_lines_rich_expected.json").read_text())
    edits = {"captionLines": exp["lines"]}
    assert normalize_caption_lines(exp["lines"]) == exp["normalized"]
    assert caption_line_words(edits) == exp["words"]
    assert caption_line_render_words(edits) == exp["render"]
    assert build_line_srt(edits) == exp["srt"]


def test_srt_cue_keeps_its_line_break_and_tags():
    lines = [{"id": "a", "text": "Hello from the SRT test\nsecond line here", "startMs": 0, "endMs": 2000},
             {"id": "b", "text": "<i>slanted</i> <b>heavy</b>", "startMs": 2000, "endMs": 3000}]
    assert "Hello from the SRT test\nsecond line here\n" in build_line_srt({"captionLines": lines})
    words = caption_line_render_words({"captionLines": lines})
    assert [w["w"] for w in words if w.get("br")] == ["second"]
    assert [(w["w"], bool(w.get("it")), bool(w.get("bo"))) for w in words[-2:]] == [("slanted", True, False), ("heavy", False, True)]
    chunks = chunk_words(words, 2)
    assert forced_breaks(chunks[0]) == [5]
    assert disp_words(chunks[1], "upper") == ["{\\i1}SLANTED{\\i0}", "{\\b1}HEAVY{\\b0}"]
    assert disp_words(chunks[1], "upper", styled=False) == ["SLANTED", "HEAVY"]


def test_forced_breaks_win_over_fit_and_only_shrink():
    fit = {"font": "Poppins", "fontsize": 60, "max_width_px": 400}
    words = [{"w": w, "s": 0, "e": 1, "br": k == 2} for k, w in enumerate(["aaaa", "bbbb", "cccccccccccccccccccccccc", "d"])]
    brk, sc = _chunk_fit(words, "upper", fit, emphasis=set(), anim="none", active_style="")
    assert brk == [2] and sc < 1.0
    assert _chunk_fit(words, "upper", None, emphasis=set(), anim="none", active_style="") == ([2], 1.0)


def test_plain_lines_unchanged():
    # Spaces still collapse; oversized cues are split instead of a 200-char cut.
    long = "word " * 60
    rows = normalize_caption_lines([{"id": "a", "text": long, "startMs": 0, "endMs": 1000}])
    kept = " ".join(r["text"].replace("\n", " ") for r in rows)
    assert kept == " ".join(long.split())
    assert all(r["endMs"] - r["startMs"] >= 100 for r in rows)
    assert serialize_tokens(line_tokens("  a   b  ")) == "a b"
    assert serialize_tokens(line_tokens("1\n2\n3\n4\n5")) == "1\n2\n3 4 5"


def test_build_ass_renders_breaks_and_italics(tmp_path):
    words = caption_line_render_words({"captionLines": [{"id": "a", "text": "<i>one two</i>\nthree", "startMs": 0, "endMs": 1500}]})
    p = tmp_path / "c.ass"
    build_ass(words, {"presetId": "clean_white", "wordsPerLine": 1}, p, play_w=1080, play_h=1080)
    ev = [l for l in p.read_text().splitlines() if l.startswith("Dialogue")]
    assert ev and all("\\N" in l and "{\\i1}" in l for l in ev)
