"""Project settings → initial clip edits (zoom / emoji flags)."""
from clips_worker.pipeline import initial_clip_edits


def test_auto_zoom_and_emojis_from_project_settings():
    edits = initial_clip_edits(
        {
            "aspectRatio": "9:16",
            "autoZoom": True,
            "autoEmojis": True,
            "captions": {"presetId": "bold"},
        }
    )
    assert edits["zoom"]["enabled"] is True
    assert edits["captions"]["keywordHighlight"] is True
    assert edits["captions"]["autoEmojis"] is True
