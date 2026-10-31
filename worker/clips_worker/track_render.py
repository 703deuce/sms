"""G1c: what tracks do to their items at render time (mirror of new-app
lib/clips/editor/track-render.ts). Runs right after apply_track_state in
apply_timeline_lane_state, so preview (renderEdits) and export see the same derived edits.
"""
from __future__ import annotations


def apply_track_render(edits: dict) -> dict:
    from clips_worker.takes import apply_takes
    from clips_worker.track_fx import apply_track_color
    from clips_worker.track_motion import apply_track_motion

    # Takes first (inactive B-roll takes never render), then track color (overlay-track looks fill
    # in B-roll items without their own look), then track motion (baked into item keyframes).
    return apply_track_motion(apply_track_color(apply_takes(edits)))
