from clips_worker.t6_geometry import resolve_template_geometry
from clips_worker.t6_pick import eligible, pick_template
from clips_worker.t6_registry import TEMPLATES
from clips_worker.t6_signals import signals_or_defaults


def test_low_conf_picks_lane_blur():
    s = signals_or_defaults({"clipType": "gaming"})
    s["type_conf"] = 0.2
    tid, reason = pick_template(s, {}, [], {}, 1, "seed")
    assert tid == "G4" and reason == "low_conf"


def test_background_action_blocks_i5():
    t = TEMPLATES["I5"]
    s = signals_or_defaults({})
    s.update({"clip_type": "irl", "type_conf": 0.9, "background_action": True, "person_count": 1})
    assert eligible(t, s, {}) is False


def test_geometry_g1_has_two_panels():
    s = signals_or_defaults({"clipType": "gaming"})
    s["facecam_box"] = {"x": 0.1, "y": 0.7, "w": 0.3, "h": 0.2}
    spec = resolve_template_geometry(TEMPLATES["G1"], s, {"layout": {}})
    assert len(spec["panels"]) == 2
    assert spec["panels"][-1]["dest"]["y"] + spec["panels"][-1]["dest"]["h"] == 1920
