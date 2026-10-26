from clips_worker.render_clip import aspect_size


def test_aspect_size_720p():
    assert aspect_size("9:16", "720p") == (720, 1280)
    assert aspect_size("1:1", "720p") == (720, 720)
    assert aspect_size("16:9", "720p") == (1280, 720)


def test_aspect_size_1080p():
    assert aspect_size("9:16", "1080p") == (1080, 1920)
    assert aspect_size("1:1", "1080p") == (1080, 1080)
    assert aspect_size("16:9", "1080p") == (1920, 1080)
