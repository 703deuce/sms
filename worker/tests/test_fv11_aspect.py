from clips_worker.render_clip import export_settings_for_aspect, is_landscape_aspect


def test_is_landscape_aspect():
    assert is_landscape_aspect("16:9")
    assert is_landscape_aspect("4:3")
    assert is_landscape_aspect("21:9")
    assert is_landscape_aspect("custom:1200x1000")
    assert not is_landscape_aspect("1:1")
    assert not is_landscape_aspect("4:5")
    assert not is_landscape_aspect("9:16")


def test_export_settings_for_aspect_fit_landscape_only():
    base = {"layout": "speaker_follow", "aspectRatio": "9:16"}
    assert export_settings_for_aspect(base, "9:16")["layout"] == "speaker_follow"
    assert export_settings_for_aspect(base, "16:9")["layout"] == "fit"
    assert export_settings_for_aspect(base, "21:9")["layout"] == "fit"
    assert export_settings_for_aspect(base, "4:3")["layout"] == "fit"
    assert export_settings_for_aspect(base, "custom:1920x1080")["layout"] == "fit"
