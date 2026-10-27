import numpy as np

from smoothing import smooth_centers


def test_smooth_centers_caps_pan_speed():
    fps = 30.0
    w = 1280
    targets = np.r_[np.full(30, 200.0), np.full(120, 900.0)]
    cuts = [30]
    y = smooth_centers(targets, fps, w, cut_indices=cuts)
    cap = 0.15 * w / fps + 2.0
    for i in range(1, len(y)):
        if i in cuts:
            continue  # hard cut may snap
        assert abs(y[i] - y[i - 1]) <= cap


def test_smooth_centers_deadzone_on_noise():
    fps = 30.0
    w = 1280
    rng = np.random.default_rng(0)
    targets = 500.0 + rng.normal(0, 5, 90)
    y = smooth_centers(targets, fps, w)
    assert np.ptp(y) < 15
