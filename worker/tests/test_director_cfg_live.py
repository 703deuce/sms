from clips_worker.reframe_core import director_cfg_from_env


def test_director_cfg_uses_calmer_defaults():
    cfg = director_cfg_from_env({})
    assert cfg.min_hold_s >= 2.25
    assert cfg.lead_s == 0.4
    assert cfg.switch_cost == 4 * 0.6
