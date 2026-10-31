"""T6.4: shared face-template families (podcast lists C1-C6 + C7-C9), pick stays sane."""
from __future__ import annotations

from clips_worker.t6_pick import (
    SHARED_FAMILY_PENALTY,
    eligible,
    in_family,
    pick_template,
    requires_for_family,
)
from clips_worker.t6_registry import TEMPLATES

FACE = {"x": 0.3, "y": 0.3, "w": 0.1, "h": 0.15, "persist": 1.0, "score": 0.9}


def _family(lane):
    return [tid for tid, t in TEMPLATES.items() if in_family(t, lane)]


def test_every_family_has_at_least_five_templates():
    for lane in ("gaming", "irl", "just_chatting", "podcast"):
        assert len(_family(lane)) >= 5, lane
    assert sorted(_family("podcast")) == ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]
    assert sorted(_family("just_chatting")) == ["C1", "C2", "C3", "C4", "C5", "C6"]


def test_native_lanes_unchanged():
    assert {tid: t["lane"] for tid, t in TEMPLATES.items() if tid.startswith("C")} == {
        **{f"C{i}": "just_chatting" for i in range(1, 7)},
        **{f"C{i}": "podcast" for i in range(7, 10)},
    }


def test_family_requires_only_apply_in_shared_family():
    assert requires_for_family(TEMPLATES["C1"], "just_chatting").get("maxPersons") is None
    assert requires_for_family(TEMPLATES["C1"], "podcast")["maxPersons"] == 1
    assert requires_for_family(TEMPLATES["C5"], "podcast")["maxPersons"] == 2
    s = {"faces": [FACE, FACE], "person_count": 2, "background_action": False}
    assert eligible(TEMPLATES["C1"], s, {}, "just_chatting")
    assert not eligible(TEMPLATES["C1"], s, {}, "podcast")  # would crop a co-host out


def _batch(s, n=5):
    hist, bc, out = [], {}, []
    for i in range(n):
        tid, _ = pick_template(s, {"duration_ms": 15000}, hist, bc, n, f"clip{i}")
        out.append(tid)
        hist.append(tid)
        bc[tid] = bc.get(tid, 0) + 1
    return out


def test_podcast_prefers_native_then_rotates_into_shared():
    s = {"clip_type": "podcast", "type_conf": 0.9, "background_action": False, "person_count": 2,
         "faces": [FACE, FACE]}
    picks = _batch(s)
    assert picks[0] == "C7"  # a native template still wins first
    assert len(set(picks)) >= 3  # batch cap now rotates into shared C2/C5/C6 instead of 5x C7
    assert "C1" not in picks and "C4" not in picks  # single-face crops excluded for 2 people
    assert SHARED_FAMILY_PENALTY > 8.3  # > max tie noise (4.29) + face bonus + history penalty


def test_podcast_no_native_eligible_uses_shared_instead_of_fallback():
    s = {"clip_type": "podcast", "type_conf": 0.9, "background_action": True, "person_count": 0, "faces": []}
    tid, reason = pick_template(s, {}, [], {}, 1, "x")
    assert reason == "scored" and in_family(TEMPLATES[tid], "podcast")


def test_just_chatting_and_other_lanes_pick_like_before():
    s = {"clip_type": "just_chatting", "type_conf": 0.9, "background_action": False, "person_count": 1,
         "faces": [FACE]}
    assert all(TEMPLATES[t]["lane"] == "just_chatting" for t in _batch(s))
    g = {"clip_type": "gaming", "type_conf": 0.9, "facecam_conf": 0.9,
         "facecam_box": {"x": 0, "y": 0.7, "w": 0.3, "h": 0.3}}
    assert all(TEMPLATES[t]["lane"] == "gaming" for t in _batch(g))


def test_auto_pick_stores_the_picked_family():
    from clips_worker.t6_pick import apply_t6_template_to_edits

    s = {"clip_type": "podcast", "type_conf": 0.9, "background_action": True, "person_count": 0, "faces": []}
    e = apply_t6_template_to_edits({"layout": {}}, signals=s, clip={}, history=[], batch_counts={},
                                   batch_size=1, seed="x")
    assert e["layout"]["template"]["lane"] == "podcast"
