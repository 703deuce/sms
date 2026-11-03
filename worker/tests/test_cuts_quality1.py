"""CUTS_QUALITY1 export crossfade + boundary tests."""
from __future__ import annotations

from clips_worker.cut_boundary_refine import refine_cut_boundary


def test_filler_touching_next_needs_review():
    frames = []
    for t in range(980, 1120, 5):
        rms = 0.02
        if 1020 <= t <= 1080:
            rms = 0.35
        if t >= 1080:
            rms = 0.4
        frames.append((t, rms))
    rng, note = refine_cut_boundary(1000, 1020, 1080, 1090, frames)
    assert rng[0] <= rng[1]
    assert "valley" in note or note != "ready"


def test_concat_uses_ten_ms_exp_fades():
    import inspect
    from clips_worker import edits_render

    src = inspect.getsource(edits_render.ffmpeg_concat_segments)
    assert "curve=exp" in src
    assert "0.01" in src
