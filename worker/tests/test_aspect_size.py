from clips_worker.render_clip import (
    aspect_size,
    export_settings_for_aspect,
    is_landscape_aspect,
    normalize_aspect_token,
)


def test_aspect_legacy_table_720():
    assert aspect_size("9:16", "720p") == (720, 1280)
    assert aspect_size("1:1", "720p") == (720, 720)
    assert aspect_size("16:9", "720p") == (1280, 720)
    assert aspect_size("4:5", "720p") == (720, 900)


def test_aspect_legacy_table_1080():
    assert aspect_size("9:16", "1080p") == (1080, 1920)
    assert aspect_size("4:5", "1080p") == (1080, 1350)


def test_aspect_43_219():
    assert aspect_size("4:3", "720p") == (960, 720)
    assert aspect_size("4:3", "1080p") == (1440, 1080)
    assert aspect_size("21:9", "720p") == (1680, 720)
    assert aspect_size("21:9", "1080p") == (2520, 1080)


def test_custom_and_invalid():
    assert aspect_size("custom:1440x1080", "720p") == (960, 720)
    assert aspect_size("custom:99999x99999", "720p")[0] <= 3840
    assert aspect_size("custom:9x9999", "720p") == (720, 1280)


def test_all_even():
    for aspect in ("9:16", "4:3", "21:9", "custom:1440x1080", "custom:3000x1000"):
        for res in ("720p", "1080p"):
            w, h = aspect_size(aspect, res)
            assert w % 2 == 0 and h % 2 == 0
