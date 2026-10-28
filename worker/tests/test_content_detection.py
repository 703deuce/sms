from clips_worker.content_detection import (
    CLIP_CONTENT_GENRE_AUTO,
    CLIP_CONTENT_MODE_AUTO,
    layout_genre_hint,
    log_ignored_legacy_content_settings,
    normalize_content_genre,
    normalize_content_mode,
)


def test_normalize_auto_payload():
    assert normalize_content_mode("auto") == CLIP_CONTENT_MODE_AUTO
    assert normalize_content_genre("auto") == CLIP_CONTENT_GENRE_AUTO
    assert normalize_content_mode("captions") == "captions"


def test_legacy_genre_maps_to_auto():
    assert normalize_content_genre("podcast") == CLIP_CONTENT_GENRE_AUTO
    assert normalize_content_genre("gaming") == CLIP_CONTENT_GENRE_AUTO


def test_legacy_log():
    assert log_ignored_legacy_content_settings({"genre": "podcast", "mode": "auto"}) == {"genre": "podcast"}
    assert log_ignored_legacy_content_settings({"genre": "auto", "mode": "auto"}) is None


def test_layout_hint_mixed():
    assert layout_genre_hint({"genre": "gaming"}) == "mixed"
