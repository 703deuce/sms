"""E4fix: text item size / box / align parity (worker ASS render ↔ editor preview model).

Renders text items with libass at 720p and 1080p and measures the burned box. The model below is the
one the preview uses (new-app/lib/clips/editor/text-frame.ts): Fontsize = round(size·H/1920), one
line = Fontsize tall, box = widest line advance (caption font metrics) + 2·pad, block centred on the
anchor whatever the alignment. new-app/tests/e4fix-text-parity.test.ts checks the TS model against
the measured fixture. Regenerate: WRITE_TEXT_PARITY_FIXTURE=1.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.caption_fit import text_width_px
from clips_worker.text_items import _METRIC_FONT, REF_H, text_items_ass

FIXTURE = Path(__file__).parent / "fixtures" / "text_item_parity.json"
FONTS_DIRS = [Path(__file__).resolve().parents[1] / "v3" / "fonts" / "t6", Path(__file__).resolve().parents[1] / "prototype" / "v3" / "fonts"]
CASES = [
    {"id": "bangers_center_box", "text": "TEST TEXT", "font": "Bangers", "size": 84, "align": "center", "x": 50, "y": 50, "pad": 16},
    {"id": "montserrat_left_2lines", "text": "Left aligned\nsecond", "font": "Montserrat", "size": 72, "align": "left", "x": 40, "y": 35, "pad": 12},
    {"id": "anton_right", "text": "RIGHT SIDE", "font": "Anton", "size": 96, "align": "right", "x": 60, "y": 70, "pad": 10},
    {"id": "luckiest_center", "text": "Luckiest", "font": "Luckiest Guy", "size": 120, "align": "center", "x": 50, "y": 20, "pad": 8},
    {"id": "bebas_left", "text": "BEBAS NEUE LEFT", "font": "Bebas Neue", "size": 110, "align": "left", "x": 50, "y": 60, "pad": 14},
    {"id": "archivo_right_2lines", "text": "Archivo\nBlack right", "font": "Archivo Black", "size": 64, "align": "right", "x": 50, "y": 45, "pad": 10},
    {"id": "poppins_center", "text": "Poppins bold", "font": "Poppins", "size": 80, "align": "center", "x": 50, "y": 80, "pad": 10},
]
RES = [(720, 1280), (1080, 1920)]


def model(c: dict, w: int, h: int) -> dict:
    fs = max(1, round(c["size"] * h / REF_H))
    pad = c["pad"] * h / REF_H
    lines = c["text"].split("\n")
    name = _METRIC_FONT.get(c["font"], c["font"])
    widths = [text_width_px(l, name, fs) for l in lines]
    bw = max(widths)
    ax, ay = c["x"] * w / 100, c["y"] * h / 100
    return {
        "x0": (ax - bw / 2 - pad) / w,
        "x1": (ax + bw / 2 + pad) / w,
        "y0": (ay - len(lines) * fs / 2 - pad) / h,
        "y1": (ay + len(lines) * fs / 2 + pad) / h,
    }


def _edits(c: dict) -> dict:
    return {"textItems": [{
        "id": "t1", "text": c["text"], "startMs": 0, "endMs": 2000, "x": c["x"], "y": c["y"],
        "style": {"font": c["font"], "size": c["size"], "color": "#0000FF", "align": c["align"],
                  "box": {"color": "#0000FF", "opacity": 100, "pad": c["pad"]}},
    }]}


def _render(c: dict, w: int, h: int, tmp: Path) -> dict:
    ass = tmp / f"{c['id']}_{h}.ass"
    ass.write_text(text_items_ass(_edits(c), w=w, h=h))
    png = tmp / f"{c['id']}_{h}.png"
    fdir = tmp / "fonts"
    if not fdir.is_dir():
        fdir.mkdir()
        for d in FONTS_DIRS:
            for f in d.glob("*.ttf"):
                shutil.copy(f, fdir / f.name)
        # Only the bundled faces (like the worker image) — never a host Montserrat / Poppins.
        (tmp / "fonts.conf").write_text(
            f'<?xml version="1.0"?><fontconfig><dir>{fdir}</dir><cachedir>{tmp / "fc-cache"}</cachedir></fontconfig>'
        )
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x00FF00:s={w}x{h}:d=1",
         "-vf", f"ass={ass}:fontsdir={fdir}", "-frames:v", "1", str(png)],
        check=True,
        env={**os.environ, "FONTCONFIG_FILE": str(tmp / "fonts.conf")},
    )
    from PIL import Image

    im = Image.open(png).convert("RGB")
    px = im.load()
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if b > 150 and g < 100:
                xs.append(x)
                ys.append(y)
    return {"x0": min(xs) / w, "x1": (max(xs) + 2) / w, "y0": min(ys) / h, "y1": (max(ys) + 2) / h}


def _have_fonts() -> bool:
    return all((d / f).is_file() for d, f in [(FONTS_DIRS[0], "Bangers.ttf"), (FONTS_DIRS[1], "Poppins-ExtraBold.ttf")])


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")
def test_text_items_render_matches_preview_model(tmp_path):
    if not _have_fonts():
        pytest.skip("bundled fonts not present")
    pytest.importorskip("PIL")
    out = []
    for c in CASES:
        row = {"case": c, "measured": {}}
        for w, h in RES:
            got = _render(c, w, h, tmp_path)
            exp = model(c, w, h)
            for k in ("x0", "x1", "y0", "y1"):
                # 0.6 % of the frame: libass glyph bearings / kerning vs advance-only metrics (max seen 0.24 %).
                assert abs(got[k] - exp[k]) < 0.006, (c["id"], h, k, got, exp)
            row["measured"][str(h)] = {k: round(v, 4) for k, v in got.items()}
        # Same result at 720p and 1080p (one reference frame).
        a, b = row["measured"]["1280"], row["measured"]["1920"]
        for k in a:
            assert abs(a[k] - b[k]) < 0.006, (c["id"], k, a, b)
        out.append(row)
    if os.environ.get("WRITE_TEXT_PARITY_FIXTURE"):
        FIXTURE.write_text(json.dumps({"cases": out}, indent=1) + "\n")
    data = json.loads(FIXTURE.read_text())
    assert [r["case"]["id"] for r in data["cases"]] == [c["id"] for c in CASES]


def test_align_keeps_block_centred_on_anchor():
    base = CASES[0] | {"text": "Two\nlines here"}
    pos = {}
    for align in ("left", "center", "right"):
        ass = text_items_ass(_edits(base | {"align": align}), w=720, h=1280)
        line = next(l for l in ass.splitlines() if l.startswith("Dialogue: 1"))
        pos[align] = line.split("\\pos(")[1].split(")")[0]
    fs = round(84 * 1280 / 1920)
    bw = text_width_px("lines here", "Bangers", fs)
    assert pos["center"] == "360,640"
    assert pos["left"] == f"{round(360 - bw / 2)},640"
    assert pos["right"] == f"{round(360 + bw / 2)},640"
