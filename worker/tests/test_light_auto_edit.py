from clips_worker.light_auto_edit import light_auto_edit


def test_strips_zoom_silence_hook_keeps_captions():
    edits = {
        "zoom": {"enabled": True},
        "silenceTrim": {"enabled": True},
        "hookOverlay": {"enabled": True, "text": "Hi"},
        "captions": {"enabled": True},
        "aspectRatio": "9:16",
    }
    out = light_auto_edit(edits, {})
    assert out["zoom"]["enabled"] is False
    assert "silenceTrim" not in out
    assert "hookOverlay" not in out
    assert out["captions"]["enabled"] is True
    assert out["aspectRatio"] == "9:16"


def test_auto_zoom_honoured():
    edits = {"zoom": {"enabled": True}}
    out = light_auto_edit(edits, {"autoZoom": True})
    assert out["zoom"]["enabled"] is True
