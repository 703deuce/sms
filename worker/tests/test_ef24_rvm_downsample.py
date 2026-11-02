"""EF-24: RVM downsample_ratio anchors (matte.py)."""
from modal_app.rvm_params import downsample_ratio


def test_downsample_ratio_portrait_anchors():
    assert downsample_ratio(1080, 1920) == 0.25
    assert downsample_ratio(720, 1280) == 0.375


def test_downsample_ratio_auto_clamps_internal():
    r = downsample_ratio(540, 960)
    assert 256 / 960 <= r <= 512 / 960
