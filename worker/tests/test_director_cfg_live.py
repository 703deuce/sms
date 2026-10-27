from clips_worker.reframe_core import director_cfg_from_env


def test_director_cfg_uses_calmer_defaults():
    cfg = director_cfg_from_env({})
    assert cfg.min_hold_s >= 2.25
    assert cfg.lead_s == 0.4
    assert cfg.switch_cost == 4 * 0.6


def test_director_cfg_maps_multiperson_layout_modes():
    g3 = director_cfg_from_env({"LAYOUT_MODE": "grid3"})
    assert g3.allow_grid and not g3.allow_split
    assert g3.grid_bias < 1.8
    debate = director_cfg_from_env({"LAYOUT_MODE": "split_debate"})
    assert debate.allow_split and not debate.allow_grid
    locked = director_cfg_from_env({"LAYOUT_MODE": "locked_off"})
    assert locked.force == "fill" and not locked.allow_split
