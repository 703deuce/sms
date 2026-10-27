from clips_worker.hook_overlay import _hook_ass


def test_hook_ass_contains_text_and_timing():
    body = _hook_ass("Wait for this", 2500, w=1080, h=1920, primary_color="#FACC15")
    assert "Wait for this" in body
    assert "0:00:02.50" in body
    assert "Style: Hook" in body
