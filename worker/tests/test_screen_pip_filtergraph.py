from clips_worker.filtergraph import screen_pip_overlay_filter, side_by_side_filter


def test_side_by_side_filter():
    assert side_by_side_filter() == "[s0][s1]hstack=inputs=2"


def test_screen_pip_overlay_contains_overlay():
    fg = screen_pip_overlay_filter("bg", "cam", "out", 1080, 1920)
    assert "overlay=" in fg
    assert "[bg]" in fg and "[cam]" in fg
