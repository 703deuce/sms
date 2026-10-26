from clips_worker.streamer.layout.render_stack import build_stack_filter


def test_stack_filter_contains_vstack():
    f = build_stack_filter(1920, 1080, {"x": 0.02, "y": 0.02, "w": 0.3, "h": 0.25}, None, split=0.4)
    assert "vstack=inputs=2" in f
    assert "[f]" in f and "[g]" in f
