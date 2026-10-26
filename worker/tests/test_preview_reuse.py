from clips_worker.edits_render import default_edits
from clips_worker.preview_reuse import can_reuse_clip_preview_for_render


def test_preview_reuse_only_720p_916_default_edits():
    edits = default_edits(0, 60_000)
    assert can_reuse_clip_preview_for_render("9:16", "720p", edits, 0, 60_000)
    assert not can_reuse_clip_preview_for_render("9:16", "1080p", edits, 0, 60_000)
    assert not can_reuse_clip_preview_for_render("1:1", "720p", edits, 0, 60_000)

    edited = {**edits, "trim": {"in": 1000, "out": 50_000}}
    assert not can_reuse_clip_preview_for_render("9:16", "720p", edited, 0, 60_000)
