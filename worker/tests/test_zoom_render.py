from clips_worker.zoom_render import (
    build_zoom_keyframes,
    clamp_zoom_intensity,
    pick_zoom_peak_times,
    ZOOM_MAX_INTENSITY,
    ZOOM_MIN_GAP_S,
)


def test_clamp_intensity():
    assert clamp_zoom_intensity(1.3) == ZOOM_MAX_INTENSITY


def test_peak_spacing():
    peaks = pick_zoom_peak_times([1.0, 3.0, 7.0, 8.0], 20.0, [])
    assert peaks == [1.0, 7.0]
    assert peaks[1] - peaks[0] >= ZOOM_MIN_GAP_S


def test_emphasis_keyframe():
    words = [{"s": 2.0, "e": 2.5, "w": "hook", "i": 0}]
    kf = build_zoom_keyframes(words, [0], 10.0, 1.12)
    assert any(z > 1.0 for _, z in kf)


def test_skip_near_layout_switch():
    words = [
        {"s": 0.0, "e": 0.5, "w": "a", "i": 0, "spk": "A"},
        {"s": 5.0, "e": 5.5, "w": "b", "i": 1, "spk": "B"},
    ]
    kf = build_zoom_keyframes(words, [1], 10.0, 1.1)
    assert all(z == 1.0 for _, z in kf)
