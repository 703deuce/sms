from clips_worker.streamer.layout.caption_anchor import caption_margin_v


def test_seam_anchor():
    align, margin = caption_margin_v("seam", stack_split=0.4)
    assert align == 2
    assert margin > 0


def test_top_anchor():
    align, margin = caption_margin_v("top")
    assert align == 8
    assert margin == 48
