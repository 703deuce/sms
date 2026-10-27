from clips_worker.caption_safe_area import clamp_caption_export_style, verify_all_presets_safe


def test_clamps_oversized_margin():
    style = clamp_caption_export_style({"presetId": "bold_pop", "marginVPct": 70, "size": 12}, play_h=1920)
    assert style["_safeAreaOk"]
    assert style["marginVPct"] < 70


def test_all_builtin_presets_safe_at_1080x1920():
    rows = verify_all_presets_safe(play_h=1920)
    assert rows
    assert all(ok for _id, ok in rows)
