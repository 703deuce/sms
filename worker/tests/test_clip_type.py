from clips_worker.clip_type import (
    content_type_from_picker_moment,
    resolve_upload_clip_type,
    upload_project_majority_type,
)
from clips_worker.picker import _annotate_clip_type_meta


def test_annotate_preserves_evidence_booleans():
    picks = [{"start_ms": 100, "end_ms": 5000, "aiMeta": {}}]
    moments = [
        {
            "start_ms": 0,
            "end_ms": 8000,
            "content_type": "just_chatting",
            "game_ui_visible": False,
            "real_camera_footage": True,
        }
    ]
    _annotate_clip_type_meta(picks, moments, None)
    vm = picks[0]["aiMeta"]["videoMoment"]
    assert vm.get("game_ui_visible") is False
    assert vm.get("real_camera_footage") is True


def test_low_iou_real_camera_moment_is_irl_not_project_gaming():
    moment = {"content_type": "irl", "real_camera_footage": True, "game_ui_visible": False}
    out = resolve_upload_clip_type(
        moment=moment,
        section_activity=None,
        upload_project_majority="gaming",
        stream_majority="gaming",
        moment_match_iou=0.238,
        has_facecam=True,
        facecam_confidence=0.79,
    )
    assert out["clipType"] == "irl"


def test_basketball_moment_with_gaming_label_is_irl():
    moment = {
        "content_type": "gaming",
        "game_ui_visible": False,
        "real_camera_footage": True,
        "category": ["gaming"],
    }
    assert content_type_from_picker_moment(moment) == "irl"


def test_facecam_050_does_not_force_gaming():
    moment = {
        "content_type": "gaming",
        "game_ui_visible": False,
        "real_camera_footage": True,
    }
    out = resolve_upload_clip_type(
        moment=moment,
        section_activity=None,
        upload_project_majority="irl",
        stream_majority=None,
        moment_match_iou=0.5,
        has_facecam=True,
        facecam_confidence=0.50,
    )
    assert out["clipType"] == "irl"


def test_real_gaming_with_ui_and_facecam():
    moment = {"content_type": "gaming", "game_ui_visible": True, "real_camera_footage": False}
    out = resolve_upload_clip_type(
        moment=moment,
        section_activity=None,
        upload_project_majority="gaming",
        stream_majority=None,
        moment_match_iou=0.5,
        has_facecam=True,
        facecam_confidence=0.957,
    )
    assert out["clipType"] == "gaming"


def test_upload_majority_irl_when_most_moments_real_camera():
    picks = [
        {"aiMeta": {"videoMoment": {"game_ui_visible": False, "real_camera_footage": True, "content_type": "gaming"}}},
        {"aiMeta": {"videoMoment": {"game_ui_visible": False, "real_camera_footage": True, "content_type": "gaming"}}},
        {"aiMeta": {"videoMoment": {"game_ui_visible": False, "real_camera_footage": True, "content_type": "irl"}}},
        {"aiMeta": {"videoMoment": {"game_ui_visible": False, "real_camera_footage": True, "content_type": "just_chatting"}}},
    ]
    assert upload_project_majority_type(picks) == "irl"
