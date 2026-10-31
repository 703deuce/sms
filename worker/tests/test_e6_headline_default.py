from clips_worker.clip_layout_policy import apply_headline_layout_default, headline_default_off


def _e(mode, enabled=True, lane=None):
    layout = {"mode": mode}
    if lane:
        layout["template"] = {"id": "x", "lane": lane}
    return {"layout": layout, "exportTemplate": {"headlineBar": {"enabled": enabled, "text": "HI"}, "suggestedHeadline": "HI"}}


def test_crop_layouts_default_off_keep_text():
    for mode in ("center_crop", "speaker_follow", "subject_follow", "fill"):
        out = apply_headline_layout_default(_e(mode), "irl")
        assert out["exportTemplate"]["headlineBar"] == {"enabled": False, "text": "HI"}
        assert out["exportTemplate"]["suggestedHeadline"] == "HI"


def test_podcast_off_by_clip_type_or_lane_or_split():
    assert headline_default_off(_e("fit_blur"), "podcast")
    assert headline_default_off(_e("fit_blur", lane="podcast"), "other")
    assert headline_default_off(_e("split"), "just_chatting")


def test_fit_layouts_keep_headline():
    for mode in ("fit_blur", "fit_top", "facecam_stack", "full_frame"):
        e = _e(mode)
        assert apply_headline_layout_default(e, "gaming") is e


def test_no_template_untouched():
    e = {"layout": {"mode": "center_crop"}}
    assert apply_headline_layout_default(e, "irl") is e
