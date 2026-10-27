from clips_worker.render_settings import settings_with_clip_ai_meta


def test_settings_merge_clip_ai_meta_layout():
    settings = {"layout": "auto", "aspectRatio": "9:16"}
    ai = {"layoutResolved": "grid3", "cropMethod": "reframe_v2"}
    merged = settings_with_clip_ai_meta(settings, ai)
    assert merged["aiMeta"]["layoutResolved"] == "grid3"
