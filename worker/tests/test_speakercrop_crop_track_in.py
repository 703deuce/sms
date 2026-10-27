from pathlib import Path


def test_speakercrop_dispatches_crop_track_in_before_v1():
    src = (Path(__file__).resolve().parents[1] / "prototype" / "v3" / "speakercrop.py").read_text(
        encoding="utf-8",
    )
    assert "CROP_TRACK_IN" in src
    idx_crop = src.index('os.environ.get("CROP_TRACK_IN")')
    idx_v2 = src.index('os.environ.get("REFRAME_V"')
    assert idx_crop < idx_v2


def test_speakercrop_v2_render_crop_track_includes_captions():
    src = (Path(__file__).resolve().parents[1] / "prototype" / "v3" / "speakercrop_v2.py").read_text(
        encoding="utf-8",
    )
    assert "def render_crop_track" in src
    assert "_caption_vf" in src
