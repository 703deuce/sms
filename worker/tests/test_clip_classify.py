import json
from pathlib import Path

import pytest

from clips_worker.clip_classify import resolve_type_from_classification
from clips_worker.clip_type import resolve_clip_type, resolve_upload_clip_type
from clips_worker.picker import _annotate_clip_type_meta

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "classify"


def _load_response(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_c5_recorded_response_gaming_with_facecam():
    cls = _load_response("c5_gaming_clip805_response.json")
    ct, conf, src = resolve_type_from_classification(
        cls, facecam_conf=0.957, picker_moment={"content_type": "just_chatting"}, fallback="just_chatting"
    )
    assert src == "classify"
    assert ct == "gaming"
    assert conf >= 0.55


def test_mixed_gui_true_high_facecam_gaming():
    cls = {
        "main_picture": "mixed",
        "game_graphics_visible": True,
        "sport_or_physical_activity": False,
        "seated_talking_to_camera": True,
        "people_on_camera": 1,
        "clip_type": "just_chatting",
        "confidence": 0.8,
        "evidence": "menu plus overlay",
    }
    ct, _, src = resolve_type_from_classification(
        cls, facecam_conf=0.957, picker_moment=None, fallback="irl"
    )
    assert src == "classify"
    assert ct == "gaming"


def test_c1_basketball_sport_forces_irl_despite_gaming_label():
    cls = _load_response("c1_irl_clip87a5_response.json")
    ct, _, src = resolve_type_from_classification(
        cls, facecam_conf=0.58, picker_moment={"content_type": "gaming"}, fallback="gaming"
    )
    assert src == "classify"
    assert ct == "irl"


def test_c1_abad_standing_real_camera_irl():
    cls = _load_response("c1_irl_clipabad_response.json")
    ct, _, src = resolve_type_from_classification(
        cls, facecam_conf=0.79, picker_moment={"content_type": "irl"}, fallback="gaming"
    )
    assert src == "classify"
    assert ct == "irl"


def test_cls_none_picker_booleans_irl():
    moment = {
        "content_type": "gaming",
        "real_camera_footage": True,
        "game_ui_visible": False,
    }
    ct, _, src = resolve_type_from_classification(
        None, facecam_conf=0.5, picker_moment=moment, fallback="gaming"
    )
    assert src == "picker"
    assert ct == "irl"


def test_cls_none_low_iou_moment_irl():
    moment = {"content_type": "irl", "real_camera_footage": True, "game_ui_visible": False}
    out = resolve_upload_clip_type(
        moment=moment,
        section_activity=None,
        upload_project_majority="gaming",
        stream_majority=None,
        moment_match_iou=0.238,
        has_facecam=True,
        facecam_confidence=0.79,
    )
    assert out["clipType"] == "irl"


def test_stream_resolve_facecam_no_game_evidence_not_gaming():
    moment = {"content_type": "gaming", "game_ui_visible": False, "real_camera_footage": True}
    out = resolve_clip_type(
        moment=moment,
        section_activity=None,
        stream_majority="gaming",
        has_facecam=True,
        facecam_confidence=0.58,
    )
    assert out["clipType"] == "irl"


def test_annotate_clip_type_meta_keeps_booleans():
    picks = [{"start_ms": 0, "end_ms": 1000, "aiMeta": {}}]
    moments = [
        {
            "start_ms": 0,
            "end_ms": 2000,
            "content_type": "gaming",
            "game_ui_visible": True,
            "real_camera_footage": False,
        }
    ]
    _annotate_clip_type_meta(picks, moments, None)
    vm = picks[0]["aiMeta"]["videoMoment"]
    assert vm["game_ui_visible"] is True
    assert vm["real_camera_footage"] is False


@pytest.mark.parametrize(
    "response_file,expected",
    [
        ("c5_gaming_clip805_response.json", "gaming"),
        ("c1_irl_clip87a5_response.json", "irl"),
        ("c1_irl_clip6829_response.json", "irl"),
        ("c1_irl_clipabad_response.json", "irl"),
    ],
)
def test_all_fixture_responses_resolve_type(response_file, expected):
    cls = _load_response(response_file)
    ct, _, src = resolve_type_from_classification(
        cls,
        facecam_conf=0.9 if expected == "gaming" else 0.6,
        picker_moment={"content_type": "other"},
        fallback="irl",
    )
    assert src == "classify"
    assert ct == expected
