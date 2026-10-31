"""EP1 Tier B: ffmpeg (worker libass) frames == stored libass-wasm (JASSUB 2.5.23, the editor preview
renderer) goldens of the same ASS, plus a speed-warp duration check. ~3 s in the clips-worker image.

Goldens: tests/fixtures/render_plan/frames/<case>_t<ms>.png — JASSUB canvas, 540×960 over black,
rendered from the .ass goldens (box harness, EP1 spec §Tier B). Tolerances are set from measured
evidence (EP1 spec): JASSUB (libass 0.17.5-git) vs bookworm libass 0.17.1 + HarfBuzz 6.0 + FreeType
2.12 + FriBidi 1.0.8 differ by mean ≤ 0.01, max ≤ 24 (antialiasing only), 0 % of ink px > 32, ink
bbox Δ 0 px on 18 of 20 frames. The exception is Inter (variable font; presets cp5 / cp11): same
glyph positions (bbox Δ ≤ 1 px) but thin strokes rasterise slightly heavier in libass-wasm (FreeType
build difference) → up to 14.6 % of ink px differ by > 32 (mean 0.06). Those get a looser limit.
The limits below leave ~10× headroom for ffmpeg's blend rounding.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
Image = pytest.importorskip("PIL.Image")

FIX = Path(__file__).resolve().parent / "fixtures" / "render_plan"
FRAMES = json.loads((FIX / "frames" / "frames.json").read_text())
W, H = 540, 960
MAX_MEAN = 0.25
MAX_PCT_INK_GT32 = 0.5
MAX_BBOX_D = 1
# Inter (variable) — measured 14.6 % / mean 0.06 / bbox 1 (EP1 spec, Tier B evidence).
VARIABLE_FONT_CASES = {"cap_cp5", "cap_cp11"}
VAR_MAX_PCT_INK_GT32 = 25.0
VAR_MAX_BBOX_D = 2


def _fontsdir() -> Path | None:
    """One flat dir with every bundled clip font (what the preview's libass-wasm loads).

    libass' fontsdir is not recursive, and the t6 caption fonts live in v3/fonts/t6 (in the
    image they are also installed into fontconfig), so symlink both into a temp dir.
    """
    env = os.environ.get("RENDER_PLAN_FONTSDIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve().parent.parent
    for base, t6 in ((Path("/app/v3/fonts"), Path("/app/v3/fonts/t6")),
                     (here / "prototype" / "v3" / "fonts", here / "v3" / "fonts" / "t6")):
        if (base / "Anton-Regular.ttf").is_file():
            flat = Path(tempfile.mkdtemp(prefix="rp_fonts_"))
            files = [f for d in (base, t6) if d.is_dir() for f in sorted(d.glob("*.ttf"))]
            # Hook text = "DejaVu Sans" bold: the image's fonts-dejavu-core copy (bookworm 2.37-6),
            # byte-identical to new-app/public/fonts/clip/DejaVuSans-Bold.ttf (repo copy preferred).
            for dv in (here.parent / "new-app" / "public" / "fonts" / "clip" / "DejaVuSans-Bold.ttf",
                       Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")):
                if dv.is_file():
                    files.append(dv)
                    break
            for f in files:
                if not (flat / f.name).exists():
                    (flat / f.name).symlink_to(f)
            return flat
    return None


def _need_ffmpeg():
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")


def _bbox(a):
    ys, xs = np.nonzero(a.max(axis=2) > 24)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None


@pytest.mark.parametrize("name,t", FRAMES, ids=[f"{n}@{t}" for n, t in FRAMES])
def test_ffmpeg_frame_matches_libass_wasm_golden(name, t):
    _need_ffmpeg()
    fonts = _fontsdir()
    if fonts is None:
        pytest.skip("bundled fonts not found")
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "f.png"
        # Hermetic: fontconfig sees ONLY the bundled clip fonts (= what libass-wasm gets in the
        # editor), so a dev box with other "Montserrat"/"Lato" installs cannot change the match.
        conf = Path(td) / "fonts.conf"
        conf.write_text(f'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>'
                        f'<dir>{fonts}</dir><cachedir>{td}/fc</cachedir></fontconfig>')
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r=30:d=1", "-vf",
             f"format=rgb24,setpts=PTS+{t}/TB,ass={FIX / (name + '.ass')}:fontsdir={fonts}", "-frames:v", "1", str(out)],
            check=True, capture_output=True, text=True, env={**os.environ, "FONTCONFIG_FILE": str(conf)},
        )
        got = np.asarray(Image.open(out).convert("RGB")).astype(int)
    want = np.asarray(Image.open(FIX / "frames" / f"{name}_t{round(t * 1000)}.png").convert("RGB")).astype(int)
    d = np.abs(got - want).max(axis=2)
    ink = (got.max(axis=2) > 24) | (want.max(axis=2) > 24)
    assert ink.any(), "golden frame is empty"
    mean = float(np.abs(got - want).mean())
    pct = 100.0 * float((d[ink] > 32).mean())
    bg, bw = _bbox(got), _bbox(want)
    bd = max(abs(x - y) for x, y in zip(bg, bw)) if bg and bw else 999
    var = name in VARIABLE_FONT_CASES
    max_pct = VAR_MAX_PCT_INK_GT32 if var else MAX_PCT_INK_GT32
    max_bd = VAR_MAX_BBOX_D if var else MAX_BBOX_D
    assert mean <= MAX_MEAN and pct <= max_pct and bd <= max_bd, (
        f"{name}@{t}: mean={mean:.3f} pct_ink_gt32={pct:.2f}% bbox_d={bd}"
    )


def test_speed_warp_duration_matches_plan():
    _need_ffmpeg()
    from clips_worker.speed import warp_filtergraph

    exp = json.loads((FIX / "speed_expected.json").read_text())[0]
    edit_ms = exp["pieces"][-1]["endMs"]
    with tempfile.TemporaryDirectory() as td:
        src, out = Path(td) / "src.mp4", Path(td) / "out.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc=s=160x284:r=30:d={edit_ms / 1000}",
             "-f", "lavfi", "-i", f"sine=f=440:d={edit_ms / 1000}", "-c:v", "libx264", "-preset", "ultrafast",
             "-c:a", "aac", "-shortest", str(src)],
            check=True, capture_output=True,
        )
        graph, v, a = warp_filtergraph(exp["pieces"], 30.0, has_audio=True)
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-filter_complex", graph, "-map", f"[{v}]", "-map", f"[{a}]",
             "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", str(out)],
            check=True, capture_output=True,
        )
        dur = float(subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", str(out)],
            text=True,
        ).strip())
    assert abs(dur * 1000 - exp["outputDurationMs"]) <= 1000 / 30 + 1
