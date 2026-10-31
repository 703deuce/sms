"""T6.6: titled face crops stay inside the facecam box (no black game strip above the face)."""
from __future__ import annotations

import pytest

from clips_worker.t6_geometry import MAX_TITLE_ZOOM, resolve_template_geometry
from clips_worker.t6_registry import TEMPLATES
from clips_worker.t6_signals import signals_or_defaults

# Clip A (c5_quiet_gaming, E2E fixture A_db): webcam strip bottom-left, streamer + plush.
BOX = {"x": 0.0, "y": 0.7304, "w": 0.4396, "h": 0.2576}
FACES = [
    {"x": 0.326, "y": 0.7878, "w": 0.0386, "h": 0.0865, "persist": 1.0, "score": 0.9},
    {"x": 0.0963, "y": 0.8094, "w": 0.0317, "h": 0.0737, "persist": 0.8, "score": 0.9},
]
TITLE_PX = 384  # fallback top title bar (TITLE_BAR_FRAC * 1920)
EPS = 1e-4


def _meta(faces, box=BOX):
    sig = {"v": 1, "clip_type": "gaming", "type_conf": 1.0, "facecam_conf": 0.95, "person_count": 1}
    if box is not None:
        sig["facecam_box"] = box
    if faces is not None:
        sig["faces"] = faces
    return {"clipType": "gaming", "signals": sig}


def _edits(tid, title=True):
    e = {"layout": {"template": {"id": tid}, "shotOverrides": []}}
    e["exportTemplate"] = {"headlineBar": {"enabled": title, "text": "Hello"}}
    return e


def _face_panel(tid, faces=FACES, title=True, box=BOX):
    spec = resolve_template_geometry(TEMPLATES[tid], signals_or_defaults(_meta(faces, box)), _edits(tid, title))
    return spec["panels"][0]


def _inside(src, box):
    return (src["x"] >= box["x"] - EPS and src["y"] >= box["y"] - EPS
            and src["x"] + src["w"] <= box["x"] + box["w"] + EPS
            and src["y"] + src["h"] <= box["y"] + box["h"] + EPS)


@pytest.mark.parametrize("tid", ["G6", "C1", "C2", "C4"])
def test_titled_face_crop_stays_inside_facecam_box(tid):
    p = _face_panel(tid)
    assert _inside(p["src"], BOX), p["src"]
    # the face is still fully visible below the title bar
    d, s, f = p["dest"], p["src"], FACES[0]
    t = max(0, min(TITLE_PX, d["y"] + d["h"]) - d["y"]) / d["h"]
    assert (f["y"] - s["y"]) / s["h"] >= t - 0.02
    assert (f["y"] + f["h"] - s["y"]) / s["h"] <= 1 + EPS
    # zoom rose, but within the limit
    assert s["h"] >= BOX["h"] / MAX_TITLE_ZOOM - EPS


def test_g1_spill_only_under_the_title():
    # G1: the 384px title covers 57% of the 672px face panel; the face cannot sit below it inside
    # the 0.2576-high box, so a minimal spill is allowed, all of it hidden under the title.
    p = _face_panel("G1")
    d, s = p["dest"], p["src"]
    t = min(TITLE_PX, d["h"]) / d["h"]
    spill = max(0.0, BOX["y"] - s["y"]) / s["h"]
    assert 0 < spill <= t + EPS
    assert s["y"] > 0.6342 + EPS  # less than 04a6faa (0.6342)
    f = FACES[0]
    assert (f["y"] - s["y"]) / s["h"] >= t - 0.02  # face below the title


@pytest.mark.parametrize("tid", ["G1", "G6", "C1", "C2", "C4"])
def test_no_title_unchanged_and_inside(tid):
    p = _face_panel(tid, title=False)
    assert _inside(p["src"], BOX)


def test_no_facecam_box_clamps_to_frame():
    p = _face_panel("C1", faces=[{"x": 0.45, "y": 0.02, "w": 0.1, "h": 0.18, "persist": 1.0, "score": 0.9}], box=None)
    s = p["src"]
    assert s["y"] >= 0 and s["y"] + s["h"] <= 1 + EPS and s["x"] >= 0 and s["x"] + s["w"] <= 1 + EPS
