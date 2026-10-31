"""G3a: text animations, manual caption lines, aspect-aware caption safe area.

Byte-level parity with the editor lives in the render_plan goldens (test_render_plan_goldens.py +
new-app/tests/ep1-render-plan-parity.test.ts). Here: the worker-only rules, plus a real libass
burn of an animated text item with the worker's ffmpeg (5.1.x: `ass` filter only).
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.caption_lines import (
    build_line_srt,
    caption_line_render_words,
    caption_line_words,
    has_caption_lines,
    normalize_caption_lines,
)
from clips_worker.caption_safe_area import caption_min_margin_v_pct, clamp_caption_export_style
from clips_worker.captions_ass import chunk_words
from clips_worker.text_anim import fit_durations, frame_anim, norm_anim, split_units, unit_state
from clips_worker.text_items import text_items_ass

FIX = Path(__file__).parent / "fixtures" / "render_plan"


def test_caption_lines_match_fixture():
    exp = json.loads((FIX / "caption_lines_expected.json").read_text())
    edits = {"captionLines": exp["lines"]}
    assert caption_line_words(edits) == exp["words"]
    assert caption_line_render_words(edits) == exp["render"]
    assert build_line_srt(edits) == exp["srt"]


def test_normalize_caption_lines_sorts_trims_overlap_and_drops_junk():
    rows = normalize_caption_lines([
        {"id": "b", "text": "second", "startMs": 1000, "endMs": 2000},
        {"id": "a", "text": "first  line", "startMs": 0, "endMs": 1200},
        {"id": "x", "text": "   ", "startMs": 0, "endMs": 900},
        {"id": "y", "text": "bad", "startMs": "0", "endMs": 900},
        {"id": "z", "text": "tiny", "startMs": 2500, "endMs": 2550},
    ])
    assert [(r["id"], r["text"], r["startMs"], r["endMs"]) for r in rows] == [("a", "first line", 0, 1200), ("b", "second", 1200, 2000)]
    assert not has_caption_lines({}) and has_caption_lines({"captionLines": rows})


def test_chunk_words_one_caption_per_line_ignores_wpl():
    words = caption_line_render_words({"captionLines": [
        {"id": "a", "text": "one two three four five", "startMs": 0, "endMs": 2000},
        {"id": "b", "text": "six", "startMs": 2000, "endMs": 2600},
    ]})
    assert [[w["w"] for w in c] for c in chunk_words(words, 2)] == [["one", "two", "three", "four", "five"], ["six"]]
    # transcript words (no ln) keep the wordsPerLine chunking
    plain = [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in words]
    assert [len(c) for c in chunk_words(plain, 2)] == [2, 2, 2]


def test_export_srt_prefers_lines():
    from clips_worker.edits_render import build_srt, export_srt

    words = [{"w": "hi", "s": 0.0, "e": 0.5}]
    assert export_srt({}, words) == build_srt(words)
    srt = export_srt({"captionLines": [{"id": "a", "text": "Hello there", "startMs": 1001, "endMs": 61500}]}, words)
    assert srt == "1\n00:00:01,001 --> 00:01:01,500\nHello there\n"


def test_default_edits_never_reuse_preview_with_lines():
    from clips_worker.edits_render import default_edits, is_default_edits

    d = default_edits(0, 10_000)
    assert is_default_edits(d, 0, 10_000)
    assert not is_default_edits({**d, "captionLines": [{"id": "a", "text": "x y", "startMs": 0, "endMs": 900}]}, 0, 10_000)


@pytest.mark.parametrize(
    "w,h,m",
    [(1080, 1920, 12.0), (1080, 1350, 10.0), (1080, 1080, 8.0), (1920, 1080, 6.0), (None, 1280, 12.0)],
)
def test_caption_min_margin_by_aspect(w, h, m):
    assert caption_min_margin_v_pct(w, h) == m
    assert clamp_caption_export_style({"presetId": "clean_white", "marginVPct": 4}, h, w)["marginVPct"] == m


def test_vertical_clamp_unchanged_without_width():
    assert clamp_caption_export_style({"marginVPct": 6}, 1920)["marginVPct"] == 12.0


def test_norm_anim_rules():
    assert norm_anim(None) is None and norm_anim({"in": {"type": "spin"}}) is None
    a = norm_anim({"in": {"type": "slide_up", "unit": "word", "durMs": 20}, "out": {"type": "typewriter", "durMs": 99999},
                   "loop": {"type": "pulse", "periodMs": True}})
    assert a == {"in": {"type": "slide_up", "unit": "block", "durMs": 100},
                 "out": {"type": "typewriter", "unit": "char", "durMs": 5000},
                 "loop": {"type": "pulse", "periodMs": 1000}}
    assert fit_durations({"in": {"durMs": 900}, "out": {"durMs": 300}}, 600) == (450, 150)
    assert fit_durations({"in": {"durMs": 900}}, 600) == (600, 0)


def test_unit_split_and_typewriter():
    assert split_units("ab c\nd", "char") == [("a", True), ("b", True), (" ", False), ("c", True), ("\n", False), ("d", True)]
    assert split_units("ab c\nd", "word") == [("ab", True), (" ", False), ("c", True), ("\n", False), ("d", True)]
    assert split_units("ab c\n\nd", "line") == [("ab c", True), ("\n", False), ("\n", False), ("d", True)]
    assert [unit_state("typewriter", k, 4, 500.0, 1000)[0] for k in range(4)] == [1.0, 1.0, 1.0, 0.0]
    st = frame_anim({"in": {"type": "fade", "unit": "block", "durMs": 400}}, 200.0, 0, 2000, 400, 0)
    assert 0 < st["op"] < 1 and st["unit"] is None


def _item(**anim):
    return {"textItems": [{"id": "t1", "text": "HELLO", "startMs": 0, "endMs": 2000, "x": 50, "y": 50,
                           "style": {"font": "Montserrat", "size": 200, "color": "#FFFFFF"}, "anim": anim}]}


def test_in_out_windows_only_per_frame_with_static_middle():
    ass = text_items_ass(_item(**{"in": {"type": "fade", "durMs": 500}, "out": {"type": "fade", "durMs": 500}}), w=1080, h=1920)
    ev = [l for l in ass.splitlines() if l.startswith("Dialogue")]
    static = [l for l in ev if l.endswith(r"{\an5\pos(540,960)}HELLO")]
    assert len(static) == 1 and ",0:00:00.50,0:00:01.50," in static[0]
    assert len(ev) == 1 + 15 + 15  # 30 fps in / out windows
    # no anim → the E4 static event, unchanged
    plain = text_items_ass({"textItems": [{**_item()["textItems"][0], "anim": None}]}, w=1080, h=1920)
    assert [l for l in plain.splitlines() if l.startswith("Dialogue")] == [r"Dialogue: 1,0:00:00.00,0:00:02.00,T0,,0,0,0,,{\an5\pos(540,960)}HELLO"]


FF = shutil.which("ffmpeg", path="/tmp/ff51") or shutil.which("ffmpeg")


def _bright(png: Path) -> int:
    raw = subprocess.run([FF, "-v", "error", "-i", str(png), "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    return sum(1 for b in raw if b > 200)


@pytest.mark.skipif(not FF, reason="ffmpeg missing")
def test_libass_burn_typewriter_reveals_over_time(tmp_path):
    """Real burn (ass filter, ffmpeg 5.1-safe): fewer letters lit early in a typewriter in."""
    edits = _item(**{"in": {"type": "typewriter", "unit": "char", "durMs": 1000}})
    ass = tmp_path / "t.ass"
    ass.write_text(text_items_ass(edits, w=360, h=640), encoding="utf-8")
    fonts = Path(__file__).resolve().parents[1] / "v3" / "fonts"
    out = tmp_path / "o.mp4"
    subprocess.run([FF, "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=360x640:d=2:r=30",
                    "-vf", f"ass={ass}:fontsdir={fonts}", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "1", str(out)], check=True)
    lit = []
    for t in ("0.15", "0.55", "1.5"):
        png = tmp_path / f"f{t}.png"
        subprocess.run([FF, "-y", "-v", "error", "-ss", t, "-i", str(out), "-frames:v", "1", str(png)], check=True)
        lit.append(_bright(png))
    assert 0 < lit[0] < lit[1] < lit[2]
