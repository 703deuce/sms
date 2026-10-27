"""Integration: <=60 s fixture through analyze_clip + frame_crops. Skips when the fixture/models are absent.
Fixture: tests/fixtures/multicam_edit.mp4 (60 s, hard cuts at 10/20/30/40/50 s) — see guide §10."""
import os, numpy as np, pytest
from clips_worker import reframe_core as rc

FIX = os.environ.get("CLIPPER_FIXTURE", "/workspace/clipper-guide/media/multicam_edit.mp4")
MODELS = os.environ.get("CLIPPER_MODELS", "/workspace/clipper-guide/models")
pytestmark = pytest.mark.skipif(not (os.path.exists(FIX) and os.path.isdir(MODELS)), reason="fixture/models missing")


def test_director_cfg_from_env_reads_layout_settings():
    assert rc.director_cfg_from_env({"SPLIT": "1", "FORCE_SPLIT": "1"}).force == "split"
    assert rc.director_cfg_from_env({"LAYOUT_MODE": "fit"}).force == "fit"
    c = rc.director_cfg_from_env({"LAYOUT_MODE": "fill"}); assert c.force == "fill" and not c.allow_split


def test_fill_gaps_never_crosses_cut():
    a = np.array([[1.0, np.nan, 3.0, np.nan, np.nan, np.nan, np.nan, 9.0]])
    rc.fill_gaps(a, [0, 4, 8], max_gap=2)
    assert a[0, 1] == 2.0                      # bridged inside shot 0
    assert a[0, 3] == 3.0                      # held at end of shot 0
    assert np.isnan(a[0, 4]) and a[0, 5] == 9.0   # shot 1: held backwards from 9.0 for <=2 samples only


@pytest.fixture(scope="module")
def track():
    return rc.analyze_clip(FIX, None, rc.director_cfg_from_env({}), models_dir=MODELS)


def test_track_v2_schema(track):
    assert track["v"] == 2 and 1 <= len(track["people"]) <= 5
    assert len(track["x0"]) >= int(59 * track["fps"])
    for s in track["segments"]:
        assert s["layout"] in {"single", "split", "three", "grid", "wide"} and s["end_ms"] > s["start_ms"]


def test_min_hold_except_at_cuts(track):
    cuts = {10.0, 20.0, 30.0, 40.0, 50.0}; segs = track["segments"]
    for s in segs[1:-1]:
        near_cut = any(abs(s["start_s"] - c) < 0.5 or abs(s["end_s"] - c) < 0.5 for c in cuts)
        assert near_cut or s["end_s"] - s["start_s"] >= 1.5 - 1e-6, s


def test_layout_changes_land_on_cuts(track):
    # with visual-only evidence on an edited source most changes should coincide with editor cuts
    starts = [s["start_s"] for s in track["segments"][1:]]
    on_cut = [min(abs(t - c) for c in (10, 20, 30, 40, 50)) < 0.5 for t in starts]
    assert sum(on_cut) >= len(starts) // 2


def test_crops_inside_frame_and_pan_capped(track):
    W, H = track["W"], track["H"]; prev = None; vmax = 0.15 * W / track["fps"] + 1
    for i in range(0, len(track["x0"]), 3):
        lay, crops = rc.frame_crops(track, i)
        for x, y, w, h in crops:
            assert 0 <= x and 0 <= y and x + w <= W and y + h <= H
    x0 = np.array(track["x0"]); single = x0 >= 0
    seg = track["_frames"]["seg_of"]
    d = np.abs(np.diff(x0)); same = single[1:] & single[:-1] & (seg[1:] == seg[:-1])
    assert d[same].max() <= vmax


def test_shot_overrides(track):
    import copy
    t = copy.deepcopy(track); s0 = t["segments"][0]
    rc.apply_shot_overrides(t, [{"i": 0, "focus": "wide"}, {"start_ms": t["segments"][1]["start_ms"], "focus": "both"}])
    assert t["segments"][0]["layout"] == "wide" and t["x0"][int(s0["start_s"] * t["fps"]) + 1] == -2
    assert t["segments"][1]["layout"] == "split" and len(t["segments"][1]["slots"]) == 2
    lay, crops = rc.frame_crops(t, int(t["segments"][1]["start_s"] * t["fps"]) + 2)
    assert lay == "split" and len(crops) == 2
