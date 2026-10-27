from pathlib import Path
from unittest.mock import patch

from clips_worker.layout_router import PersonCountSummary, route_multiperson_layout
from clips_worker.reframe_routing import apply_production_reframe_routing
from clips_worker.reframe_v2 import reframe_v2_ops_enabled


def test_two_person_auto_routes_dynamic_not_forced_split():
    layout, use_v2 = route_multiperson_layout(
        PersonCountSummary(n_persons=2, confidence=0.9),
        "auto",
    )
    assert layout == "dynamic"
    assert use_v2 is True


def test_ops_flag_default_off():
    assert reframe_v2_ops_enabled() is False


def test_three_faces_v1_path_when_ops_flag_off(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("REFRAME_V2_ENABLED", raising=False)
    monkeypatch.delenv("REFRAME_V", raising=False)
    video = tmp_path / "x.mp4"
    video.write_bytes(b"")
    summary = PersonCountSummary(n_persons=3, confidence=0.9)

    with patch("clips_worker.reframe_routing._v3_probe", return_value=summary):
        layout, extra, shadow = apply_production_reframe_routing(
            video,
            {"layout": "auto", "mode": "talking"},
            0,
        )

    assert extra.get("REFRAME_V") != "2"
    assert shadow.get("probed") is False
    assert shadow.get("reframeV2Enabled") is False


def test_user_split_layout_kept_when_v2_off(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("REFRAME_V2_ENABLED", raising=False)
    video = tmp_path / "x.mp4"
    video.write_bytes(b"")
    layout, extra, _ = apply_production_reframe_routing(video, {"layout": "split"}, 0)
    assert layout == "split"
    assert extra.get("REFRAME_V") != "2"


def test_three_faces_v2_when_ops_flag_on(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("REFRAME_V2_ENABLED", "1")
    monkeypatch.setenv("CLIPPER_AUTO_MP_ROUTE", "1")
    video = tmp_path / "x.mp4"
    video.write_bytes(b"")
    summary = PersonCountSummary(n_persons=3, confidence=0.9)

    with patch("clips_worker.reframe_routing._v3_probe", return_value=summary):
        layout, extra, shadow = apply_production_reframe_routing(
            video,
            {"layout": "auto", "mode": "talking"},
            0,
        )

    assert extra.get("REFRAME_V") == "2"
    assert layout == "grid3"
    assert shadow.get("appliedLayout") == "grid3"
