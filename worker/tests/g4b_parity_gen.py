"""G4b TS↔Py parity fixture (new-app/tests/fixtures/g4b_parity.json).

    cd worker && python3 tests/g4b_parity_gen.py   # rewrite the fixture

Python models (xfade_masks, fx_library, layer_fx) are checked against real ffmpeg 5.1 in
tests/test_g4b_*.py; the TS side (transitions.ts, fx-library.ts, layer-fx.ts) is checked against this
fixture in new-app/tests/g4b-parity.test.ts.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from clips_worker import fx_library as fl  # noqa: E402
from clips_worker.layer_fx import key_pixel, mask_alpha, mask_geom_at, normalize_layer_fx  # noqa: E402
from clips_worker.xfade_masks import MASK_XFADE, b_weight, window_progress  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[2] / "new-app" / "tests" / "fixtures" / "g4b_parity.json"
XW, XH = 24, 16


def _checksum(a: np.ndarray) -> list[int]:
    flat = a.astype(np.int64).ravel()
    return [int(flat.sum()), int((flat * (np.arange(flat.size) % 9973 + 1)).sum() % 2147483647)]


def build() -> dict:
    xf = []
    for name in MASK_XFADE:
        for n, k in ((10, 1), (10, 5), (9, 7)):
            P = window_progress(k, n)
            w = b_weight(name, P, XW, XH)
            xf.append({"name": name, "n": n, "k": k, "P": P, "w": np.round(w.astype(float), 5).ravel().tolist()})
    masks = []
    cases = [
        ("rect", {"x": 50, "y": 50, "w": 60, "h": 40, "rot": 0, "feather": 0}, False, 1920, 1080),
        ("rect", {"x": 40, "y": 55, "w": 30, "h": 70, "rot": 25, "feather": 30}, False, 1080, 1920),
        ("ellipse", {"x": 50, "y": 50, "w": 50, "h": 50, "rot": 0, "feather": 10}, False, 1080, 1920),
        ("ellipse", {"x": 30, "y": 70, "w": 80, "h": 20, "rot": -40, "feather": 60}, True, 1920, 1080),
        ("linear", {"x": 50, "y": 40, "w": 60, "h": 40, "rot": 90, "feather": 20}, False, 1080, 1080),
        ("mirror", {"x": 50, "y": 50, "w": 60, "h": 20, "rot": 15, "feather": 5}, True, 1080, 1920),
    ]
    for shape, g, inv, W, H in cases:
        a = mask_alpha(shape, g, inv, W, H)
        masks.append({"shape": shape, "g": g, "invert": inv, "W": W, "H": H, "mw": int(a.shape[1]), "mh": int(a.shape[0]),
                      "sum": _checksum(a), "samples": [[int(j), int(i), int(a[j, i])] for j, i in
                                                       ((0, 0), (a.shape[0] // 2, a.shape[1] // 2), (a.shape[0] // 3, a.shape[1] // 4),
                                                        (a.shape[0] - 1, a.shape[1] - 1))]})
    keyed = {"shape": "rect", "x": 10, "y": 50, "w": 20, "h": 20, "rot": 0, "feather": 0,
             "keys": [{"ms": 0, "x": 10, "y": 50, "w": 20, "h": 20, "rot": 0, "feather": 0},
                      {"ms": 730, "x": 90, "y": 40, "w": 40, "h": 10, "rot": 45, "feather": 50},
                      {"ms": 1500, "x": 50, "y": 50, "w": 20, "h": 20, "rot": 0, "feather": 0}]}
    geom = [{"ms": ms, "g": {k: round(v, 6) for k, v in mask_geom_at(keyed, ms).items()}} for ms in (0, 99, 100, 365, 730, 731, 1100, 1499, 2000)]
    rng = np.random.default_rng(11)
    pix = rng.integers(0, 256, (40, 3)).tolist() + [[0, 255, 0], [40, 200, 60], [90, 160, 90], [10, 20, 240], [120, 130, 250]]
    keys = [{"color": "#00ff00", "sim": 40, "blend": 10, "spill": 50}, {"color": "#00ff00", "sim": 20, "blend": 0, "spill": 0},
            {"color": "#0000ff", "sim": 30, "blend": 30, "spill": 100}, {"color": "#33cc55", "sim": 60, "blend": 5, "spill": 80}]
    key = [{"key": k, "px": pix, "out": [[a, list(c)] for a, c in (key_pixel(p, k) for p in pix)]} for k in keys]
    fx = []
    for v, W, H in ((35, 1080, 1920), (100, 1920, 1080), (7, 720, 1280)):
        fx.append({
            "v": v, "W": W, "H": H,
            "blur": round(fl.blur_sigma(v, W, H), 6), "glow": round(fl.glow_opacity(v), 6), "rgbsplit": fl.rgbsplit_px(v, W, H),
            "bands": fl.glitch_bands(v, W, H), "thr": round(fl.glitch_threshold(v), 6),
            "glitch": [fl.glitch_state(v, W, H, f) for f in (0, 1, 7, 29, 300)],
            "shakePad": fl.shake_pad(v, W, H), "shakeSize": list(fl.shake_size(v, W, H)),
            "shake": [list(fl.shake_offset(v, W, H, f)) for f in (0, 1, 7, 29, 300)],
            "flicker": [round(fl.flicker_gain(v, f), 6) for f in (0, 1, 7, 29, 300)],
            "scanPeriod": fl.scanline_period(W, H),
            "scan": _checksum(np.asarray(fl.scanline_mask(v, W, H))[:, 0]),
        })
    norm_in = [
        {"target": "broll:a", "mask": {"shape": "ellipse", "x": 500, "feather": -3, "keys": [{"ms": 5.4, "x": 1}, {"ms": -1}]}, "blend": "normal"},
        {"target": "broll:b", "key": {"color": "#00FF00", "sim": "70"}, "blend": "screen", "reverse": True},
        {"target": "bad target"}, {"target": "broll:c"}, {"target": "broll:d", "blend": "nope", "reverse": 1},
    ]
    return {"xfade": {"W": XW, "H": XH, "cases": xf}, "masks": masks, "maskKeyed": keyed, "maskGeom": geom, "key": key, "fx": fx,
            "normalize": {"in": norm_in, "out": normalize_layer_fx(norm_in)}}


if __name__ == "__main__":
    FIXTURE.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
    print(FIXTURE, FIXTURE.stat().st_size)
