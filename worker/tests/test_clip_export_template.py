from clips_worker.clip_export_template import fit_16x9_rect, headline_layout


def test_headline_layout_shorts_text_below_380():
    bar_h, text_y = headline_layout("youtube_shorts", 1080, 1920)
    assert text_y >= 200
    assert bar_h >= 384


def test_fit_16x9_full_width():
    x, y, w, h = fit_16x9_rect(1080, 1920)
    assert w == 1080
    assert h == 608
    assert y == (1920 - h) // 2
