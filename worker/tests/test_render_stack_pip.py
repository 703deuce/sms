from clips_worker.streamer.layout.render_stack import build_pip_filter, build_stack_filter


def test_stack_filter_out_dimensions():
    f = build_stack_filter(
        1920,
        1080,
        {"x": 0.02, "y": 0.02, "w": 0.3, "h": 0.25},
        None,
        split=0.4,
        out_w=720,
        out_h=1280,
    )
    assert "scale=720:" in f
    assert "vstack=inputs=2" in f


def test_pip_filter_contains_overlay():
    f = build_pip_filter(1920, 1080, {"facecam": {"x": 0.7, "y": 0.6, "w": 0.2, "h": 0.25}}, out_w=1080, out_h=1920)
    assert "overlay=" in f
    assert "bgfull" in f
