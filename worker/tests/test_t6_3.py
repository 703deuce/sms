"""T6.3: face-aware panels, person fallback, title pick luminance, eligibility, classify."""
from __future__ import annotations

import pytest

from clips_worker.t6_geometry import resolve_template_geometry
from clips_worker.t6_registry import TEMPLATES
from clips_worker.t6_signals import signals_or_defaults

FC = {"x": 0.0, "y": 0.7104, "w": 0.7, "h": 0.2896}
GP = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 0.7104}
FACE = {"x": 0.326, "y": 0.7878, "w": 0.0386, "h": 0.0865, "persist": 1.0, "score": 0.9}


def _meta(faces, lane="gaming"):
    return {
        "clipType": lane,
        "facecamLayout": {"facecam": FC, "gameplay": GP, "confidence": 0.9},
        "signals": {"v": 1, "facecam_box": FC, "facecam_conf": 0.9, "clip_type": lane, "type_conf": 0.9,
                    **({"faces": faces} if faces is not None else {})},
    }


def _edits(tid, *, title=False, fc_box=None):
    e = {"layout": {"template": {"id": tid}}}
    if fc_box:
        e["layout"]["facecam"] = {"box": fc_box}
    if title:
        e["exportTemplate"] = {"headlineBar": {"enabled": True, "text": "Hello"}}
    return e


def _center(b):
    return b["x"] + b["w"] / 2, b["y"] + b["h"] / 2


def _contains(b, x, y):
    return b["x"] <= x <= b["x"] + b["w"] and b["y"] <= y <= b["y"] + b["h"]


def test_g6_face_panel_centres_on_face():
    s = signals_or_defaults(_meta([FACE]))
    spec = resolve_template_geometry(TEMPLATES["G6"], s, _edits("G6"))
    src = spec["panels"][0]["src"]
    fx, fy = _center(FACE)
    assert _contains(src, fx, fy)
    assert abs(_center(src)[0] - fx) < 0.02
    assert src["h"] < FC["h"] + 1e-6  # zoomed into the facecam, not the whole frame


def test_g1_facecam_cover_centres_on_face():
    s = signals_or_defaults(_meta([FACE]))
    spec = resolve_template_geometry(TEMPLATES["G1"], s, _edits("G1"))
    face_panel = spec["panels"][0]  # registry G1: panel 0 = face (facecam_box)
    assert _contains(face_panel["src"], *_center(FACE))


def test_title_bar_moves_face_into_visible_part():
    s = signals_or_defaults(_meta([FACE]))
    a = resolve_template_geometry(TEMPLATES["G6"], s, _edits("G6"))["panels"][0]["src"]
    b = resolve_template_geometry(TEMPLATES["G6"], s, _edits("G6", title=True))["panels"][0]["src"]
    fy = _center(FACE)[1]
    # with the title over the top of the panel, the face sits lower in the crop
    assert (fy - b["y"]) / b["h"] > (fy - a["y"]) / a["h"]


def test_game_panel_excludes_facecam_strip():
    s = signals_or_defaults(_meta([FACE]))
    spec = resolve_template_geometry(TEMPLATES["G6"], s, _edits("G6"))
    game = spec["panels"][1]["src"]
    assert game["y"] + game["h"] <= GP["h"] + 1e-3


def test_facecam_drag_changes_g6_face_panel():
    s = signals_or_defaults(_meta([FACE]))
    a = resolve_template_geometry(TEMPLATES["G6"], s, _edits("G6"))["panels"][0]["src"]
    b = resolve_template_geometry(
        TEMPLATES["G6"], s, _edits("G6", fc_box={"x": 0.05, "y": 0.75, "w": 0.2, "h": 0.2})
    )["panels"][0]["src"]
    assert a != b


@pytest.mark.parametrize("tid", ["I5", "I6"])
def test_person_template_without_face_is_whole_frame(tid):
    s = signals_or_defaults(_meta([], lane="irl"))
    spec = resolve_template_geometry(TEMPLATES[tid], s, _edits(tid))
    for p in spec["panels"]:
        assert p["src"] == {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0} or p["src"]["w"] >= 0.999
        assert p["fit"] == "contain_blur"


def test_face_templates_ineligible_without_faces():
    from clips_worker.t6_pick import eligible

    s = signals_or_defaults(_meta([], lane="irl"))
    assert not eligible(TEMPLATES["I5"], s, {})
    s2 = signals_or_defaults(_meta([FACE], lane="irl"))
    s2["person_count"] = 1
    # with a detected face the face requirement no longer blocks it
    from clips_worker.t6_pick import _needs_detected_face

    assert _needs_detected_face(TEMPLATES["I5"])


def test_title_pick_never_black_on_dark():
    from clips_worker.t6_titles import pick_title_style

    s = {"bands": {k: {"luma": 0.12, "busy": 0.4} for k in ("top", "caption", "bottom")}}
    spec = resolve_template_geometry(TEMPLATES["G6"], signals_or_defaults(_meta([FACE])), _edits("G6"))
    sid, _ = pick_title_style(spec, s, [])
    assert sid != "black_on_light_blur"
    s_light = {"bands": {k: {"luma": 0.85, "busy": 0.2} for k in ("top", "caption", "bottom")}}
    spec_c6 = resolve_template_geometry(TEMPLATES["C6"], signals_or_defaults(_meta(None, "just_chatting")), _edits("C6"))
    assert pick_title_style(spec_c6, s_light, [])[0] == "black_on_light_blur"


def test_classify_seated_requires_person_and_sport_wins():
    from clips_worker.clip_classify import resolve_type_from_classification as r

    base = {"confidence": 0.9, "main_picture": "real_camera", "seated_talking_to_camera": True}
    assert r({**base, "people_on_camera": 1}, facecam_conf=0, picker_moment=None, fallback="irl")[0] == "just_chatting"
    assert r({**base, "people_on_camera": 2}, facecam_conf=0, picker_moment=None, fallback="irl")[0] == "podcast"
    assert r({**base, "people_on_camera": 0}, facecam_conf=0, picker_moment=None, fallback="irl")[0] == "irl"
    assert r({**base, "people_on_camera": 1, "sport_or_physical_activity": True},
             facecam_conf=0, picker_moment=None, fallback="irl")[0] == "irl"
    assert r({**base, "seated_talking_to_camera": False, "people_on_camera": 1},
             facecam_conf=0, picker_moment=None, fallback="irl")[0] == "irl"


def test_detect_faces_none_without_model(monkeypatch, tmp_path):
    from clips_worker import t6_cv

    monkeypatch.setattr(t6_cv, "_yunet_path", lambda: None)
    assert t6_cv.detect_faces(tmp_path / "missing.mp4") is None
