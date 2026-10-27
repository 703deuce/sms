from pathlib import Path
from unittest.mock import patch

from clips_worker.layout_router import PersonCountSummary
from clips_worker.reframe_routing import apply_production_reframe_routing
from clips_worker.reframe_v2 import reframe_v2_ops_enabled


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
    assert layout == "speaker_follow"
    assert shadow.get("routedLayout") == "grid3"
    assert shadow.get("appliedLayout") == "speaker_follow"
    assert shadow.get("useReframeV2") is True
    assert shadow.get("reframeV2Enabled") is False


def test_three_faces_v2_when_ops_flag_on(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("REFRAME_V2_ENABLED", "1")
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
