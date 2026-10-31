"""G3b: layer presets (B-roll), rich text, shapes / stickers / progress, workspace fonts."""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker import motion
from clips_worker.broll_render import _shift_target
from clips_worker.caption_fit import _all_metrics, register_font_metrics, text_width_px
from clips_worker.text_anim import LAYER_TYPES, norm_layer_anim
from clips_worker.text_items import (
    font_names,
    gradient_of,
    letter_spacing_px,
    line_height_mult,
    norm_marks,
    rich_chars,
    safe_family,
    text_items,
    text_items_ass,
    user_font_id,
)
from clips_worker.text_shapes import bgr, is_hex, library, scale_path, shape_spec

ROOT = Path(__file__).resolve().parents[2]
FIX = Path(__file__).parent / "fixtures" / "render_plan"


# ---- layer presets ---------------------------------------------------------------------------


def test_norm_layer_anim_block_only_typewriter_to_fade():
    a = norm_layer_anim({"in": {"type": "typewriter", "unit": "char", "durMs": 400}, "out": {"type": "pop", "unit": "word"},
                         "loop": {"type": "pulse", "periodMs": 900}})
    assert a == {"in": {"type": "fade", "unit": "block", "durMs": 400}, "out": {"type": "pop", "unit": "block", "durMs": 500},
                 "loop": {"type": "pulse", "periodMs": 900}}
    assert norm_layer_anim({"in": {"type": "nope"}}) is None and "typewriter" not in LAYER_TYPES


def _ev(expr: str, t: float) -> float:
    env = {
        "clip": lambda x, a, b: min(max(x, a), b),
        "if_": lambda c, a, b: a if c else b,
        "lt": lambda a, b: 1.0 if a < b else 0.0,
        "mod": lambda a, b: a - b * math.floor(a / b),
        "abs": abs,
        "t": t,
    }
    return eval(expr.replace("if(", "if_("), {"__builtins__": {}}, env)  # noqa: S307 — test-only, our own expression


def _edits(anim, start=1000, end=4000):
    return {"broll": [{"id": "b1", "startMs": start, "endMs": end, "anim": anim}]}


ANIMS = [
    {"in": {"type": "slide_left", "durMs": 600}, "out": {"type": "slide_down", "durMs": 500}},
    {"in": {"type": "pop", "durMs": 500}, "out": {"type": "zoom", "durMs": 700}, "loop": {"type": "wiggle", "periodMs": 800}},
    {"in": {"type": "slide_up", "durMs": 2500}, "out": {"type": "slide_right", "durMs": 2500}},  # overlapping → fit_durations
    {"loop": {"type": "bounce", "periodMs": 500}},
    {"loop": {"type": "pulse", "periodMs": 700}, "out": {"type": "slide_up", "durMs": 300}},
]


@pytest.mark.parametrize("anim", ANIMS)
def test_layer_anim_exprs_equal_layer_anim_at(anim):
    e = _edits(anim)
    ex = motion.layer_anim_exprs(e, "broll:b1", origin_s=1.0)
    for f in range(0, 31 * 4):
        t = 1.0 + f / 30.0
        want = motion.layer_anim_at(e, "broll:b1", (t - 1.0) * 1000)
        for k, ident in (("sc", 1.0), ("dx", 0.0), ("dy", 0.0), ("rot", 0.0)):
            got = _ev(ex[k], t) if k in ex else ident
            assert got == pytest.approx(want[k], abs=1e-9), (k, t)


def test_out_slide_down_moves_layer_down():
    e = _edits({"out": {"type": "slide_down", "durMs": 500}})
    assert motion.layer_anim_at(e, "broll:b1", 2990)["dy"] > motion.layer_anim_at(e, "broll:b1", 2700)["dy"] > 0


def test_has_layer_fx_and_opacity_and_window_shift():
    e = _edits({"in": {"type": "fade", "durMs": 1000}})
    assert motion.has_layer_fx(e, "broll:b1") and not motion.has_layer_fx(_edits(None), "broll:b1")
    assert motion.layer_opacity_at(e, "broll:b1", 1.5, 1.0) == pytest.approx(motion.layer_anim_at(e, "broll:b1", 500)["op"])
    # transition windows render window-local (origin 0, shifted keyframes) — the preset follows
    local = _shift_target(e, "broll:b1", 0.25)
    assert local["_animShiftMs"] == {"broll:b1": 250.0}
    assert motion.layer_opacity_at(local, "broll:b1", 0.1, 0.0) == pytest.approx(motion.layer_opacity_at(e, "broll:b1", 1.35, 1.0))


def test_layer_motion_chain_carries_the_preset_and_sendcmd_opacity():
    e = _edits({"in": {"type": "slide_left", "durMs": 500}, "out": {"type": "fade", "durMs": 500}})
    graph, tags = motion.layer_motion_chain(e, "broll:b1", w=720, h=1280, origin_s=1.0, label_in="b", label_out="o",
                                            bg_label="bg", cmd_file="/tmp/x.cmd")
    assert "clip(" in graph and any(t.startswith("ccm_") for t in tags)
    cmd = motion.layer_sendcmd(e, "broll:b1", tags, w=720, h=1280, start_s=1.0, end_s=4.0, origin_s=1.0)
    vals = [float(x.split(" aa ")[1].rstrip(";")) for x in cmd.split("\n") if " aa " in x]
    assert vals[0] < 0.2 and max(vals) == 1.0 and vals[-1] < 0.2


FF = next((p for p in (os.environ.get("FFMPEG51"), "/tmp/ff51/ffmpeg", shutil.which("ffmpeg")) if p and Path(p).is_file()), None)


@pytest.mark.skipif(FF is None, reason="ffmpeg not available")
def test_ffmpeg_renders_the_slide_where_the_preview_puts_it(tmp_path):
    """Real ffmpeg (5.1 in prod): a red frame-sized layer sliding in from the right — the left
    edge at frame f is at dx(f)·W/100 (the preview's translate)."""
    w, h = 320, 240
    e = _edits({"in": {"type": "slide_left", "durMs": 1000}}, start=0, end=2000)
    cmd_file = tmp_path / "o.cmd"
    graph, tags = motion.layer_motion_chain(e, "broll:b1", w=w, h=h, origin_s=0.0, label_in="lay", label_out="out",
                                            bg_label="bg", cmd_file=str(cmd_file))
    cmd_file.write_text(motion.layer_sendcmd(e, "broll:b1", tags, w=w, h=h, start_s=0.0, end_s=2.0, origin_s=0.0))
    fc = f"color=c=black:s={w}x{h}:r=30:d=2[bg];color=c=red:s={w}x{h}:r=30:d=2[lay];{graph}"
    out = tmp_path / "f.rgb"
    subprocess.run([FF, "-v", "error", "-y", "-filter_complex", fc, "-map", "[out]", "-frames:v", "20", "-f", "rawvideo",
                    "-pix_fmt", "rgb24", str(out)], check=True)
    raw = out.read_bytes()
    row = h // 2
    for f in (3, 9, 15):
        fr = raw[f * w * h * 3:(f + 1) * w * h * 3]
        first_red = next(x for x in range(w) if fr[(row * w + x) * 3] > 20)
        want = motion.layer_anim_at(e, "broll:b1", f * 1000 / 30)["dx"] * w / 100
        assert abs(first_red - want) <= 2, (f, first_red, want)


# ---- rich text --------------------------------------------------------------------------------


def test_marks_spacing_lineheight_gradient_normalisers():
    assert norm_marks([{"s": -3, "e": 99, "b": True}, {"s": 2, "e": 2, "i": True}, {"s": 1, "e": 3}], 5) == [{"s": 0, "e": 5, "b": True}]
    assert [f for _, f in rich_chars({"text": "aß", "marks": [{"s": 1, "e": 2, "i": True}]}, True)] == [0, 2, 2]
    assert letter_spacing_px({"letterSpacing": 500}, 1920) == 100.0 and letter_spacing_px({"letterSpacing": "x"}, 1920) == 0.0
    assert line_height_mult({"lineHeight": 0.1}) == 0.7 and line_height_mult({}) == 1.0
    assert gradient_of({"gradient": {"from": "#000000", "to": "#FFFFFF"}})["dir"] == "v"
    assert gradient_of({"gradient": {"from": "#00000", "to": "#FFFFFF"}}) is None


def test_old_items_unchanged_spacing_column_zero():
    ass = text_items_ass({"textItems": [{"id": "a", "text": "hi", "startMs": 0, "endMs": 900}]}, w=1080, h=1920)
    assert ",100,100,0,0,1," in ass and "\\clip" not in ass


def test_user_font_names_and_safety():
    assert user_font_id("user:abc-1_2") == "abc-1_2" and user_font_id("user:bad id") is None and user_font_id("Anton") is None
    assert safe_family(" A,{b}\\c\n") == "Abc"
    assert font_names({"font": "user:x1", "fontFamily": "Grand Hotel"}) == ("Grand Hotel", "Grand Hotel")
    assert font_names({"font": "user:x1"}) == ("Montserrat Black", "Montserrat Black")


def test_register_font_metrics_measures_with_the_upload():
    before = text_width_px("WWW", "Test Upload Font", 100)
    assert register_font_metrics("Test Upload Font", {"unitsPerEm": 1000, "defaultAdv": 500, "assEmPerFontsize": 1.0, "adv": {"87": 2000}})
    assert text_width_px("WWW", "Test Upload Font", 100) == pytest.approx(600.0) != before
    assert not register_font_metrics("x", {"unitsPerEm": 0})
    _all_metrics().pop("Test Upload Font", None)


# ---- shapes -----------------------------------------------------------------------------------


def test_shape_library_is_the_web_file():
    web = ROOT / "new-app" / "lib" / "clips" / "render-plan" / "text-shapes.json"
    assert web.read_bytes() == (Path(__file__).resolve().parents[1] / "clips_worker" / "text_shapes.json").read_bytes()
    lib = library()
    assert {"rect", "circle", "star", "heart", "arrow"} <= set(lib["shapes"]) and len(lib["stickers"]) >= 10
    for st in lib["stickers"].values():
        assert st["label"] and all(is_hex(p["c"]) for p in st["parts"])


def test_shape_spec_and_colour_safety():
    assert shape_spec({"kind": "shape", "shape": {"type": "rect", "w": 99999, "h": "12"}}) == {"kind": "shape", "type": "rect", "w": 3840, "h": 12.0}
    assert shape_spec({"kind": "sticker", "sticker": "nope"}) is None
    assert shape_spec({"kind": "progress", "progress": {"track": "#zzzzzz"}})["track"] is None
    assert bgr("#zzzzzz") == "&HFFFFFF&" and bgr("#112233") == "&H332211&"
    assert scale_path("m 0 0 l 1000 500", 200, 100) == "m 0 0 l 200 50"
    items = text_items({"textItems": [{"id": "s", "kind": "shape", "shape": {"type": "rect"}, "startMs": 0, "endMs": 500},
                                      {"id": "x", "kind": "shape", "shape": {"type": "?"}, "startMs": 0, "endMs": 500}]})
    assert [i["id"] for i in items] == ["s"]


# ---- workspace fonts ----------------------------------------------------------------------------


class _Cur:
    def __init__(self, rows):
        self.rows, self.sql = rows, None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, args):
        self.sql, self.args = sql, args

    def fetchall(self):
        return self.rows


class _Conn:
    def __init__(self, rows):
        self.cur = _Cur(rows)

    def cursor(self):
        return self.cur


def test_prepare_user_fonts_downloads_registers_and_merges(tmp_path, monkeypatch):
    from clips_worker import storage, user_fonts

    src = next(Path("/tmp").glob("rp_fonts_*/Anton-Regular.ttf"), None) or next(ROOT.glob("**/Anton-Regular.ttf"), None)
    if src is None:
        pytest.skip("no font file to stand in for an upload")
    monkeypatch.setattr(storage, "download_object", lambda key, dest: shutil.copy(src, dest))
    base = tmp_path / "bundled"
    base.mkdir()
    (base / "Poppins-ExtraBold.ttf").write_bytes(b"x")
    try:
        import clips_worker.title_fit as tf  # the deployed worker has it
    except ImportError:  # trimmed local tree
        import sys
        import types

        tf = types.ModuleType("clips_worker.title_fit")
        monkeypatch.setitem(sys.modules, "clips_worker.title_fit", tf)
    monkeypatch.setattr(tf, "clip_fonts_dir", lambda: base, raising=False)
    rows = [("f1", "Grand {Hotel}", "fonts/ws/f1.ttf", "GrandHotel.ttf",
             {"unitsPerEm": 1000, "defaultAdv": 500, "assEmPerFontsize": 0.8, "adv": {}})]
    conn = _Conn(rows)
    edits = {"textItems": [{"id": "a", "text": "x", "startMs": 0, "endMs": 1, "style": {"font": "user:f1", "fontFamily": "spoof"}},
                           {"id": "b", "text": "y", "startMs": 0, "endMs": 1, "style": {"font": "Anton"}}]}
    out = user_fonts.prepare_user_fonts(conn, "ws", edits, tmp_path)
    assert conn.cur.args == ("ws", ["f1"]) and 'clip_fonts' in conn.cur.sql
    assert out["textItems"][0]["style"]["fontFamily"] == "Grand Hotel" and out["textItems"][1] == edits["textItems"][1]
    d = Path(out["_fontsDir"])
    assert sorted(p.name for p in d.iterdir()) == ["Poppins-ExtraBold.ttf", "f1.ttf"]
    assert user_fonts.fonts_dir_for(out) == d
    assert "Grand Hotel" in _all_metrics()
    _all_metrics().pop("Grand Hotel", None)
    # no user fonts → unchanged, no query
    assert user_fonts.prepare_user_fonts(_Conn([]), "ws", {"textItems": [edits["textItems"][1]]}, tmp_path) == {"textItems": [edits["textItems"][1]]}


def test_layer_anim_fixture_matches_worker():
    """g3b_layer_anim.json (the web preview's layerAnimAt expectations) == motion.layer_anim_at."""
    import json
    from pathlib import Path

    from clips_worker.motion import layer_anim_at

    fix = json.loads((Path(__file__).parent / "fixtures/render_plan/g3b_layer_anim.json").read_text())
    for c in fix:
        for s in c["samples"]:
            r = layer_anim_at({"broll": [c["item"]]}, "broll:" + c["item"]["id"], s["t"])
            for k in ("op", "sc", "dx", "dy", "rot"):
                assert abs(r[k] - s[k]) < 1e-8, (c["item"]["id"], s["t"], k)
