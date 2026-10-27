from clips_worker.render_clip import aspect_size


def test_aspect_45_720p():
    assert aspect_size("4:5", "720p") == (720, 900)


def test_aspect_45_1080p():
    assert aspect_size("4:5", "1080p") == (1080, 1350)
