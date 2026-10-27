import numpy as np

from clips_worker.crop_format import crop_track_version, is_v2_crop_track, v2_to_legacy_shots
from clips_worker.filtergraph import grid4_xstack_filter, two_up_vstack_filter
from prototype.v3.director import (
    hungarian_map_speakers,
    merge_short_segments,
    run_director,
    style_config,
)
from prototype.v3.smoothing import FollowState, follow
from prototype.v3.tracking import Det, Tracklet, associate_frame, box_iou, cluster_tracklets


def test_box_iou_and_associate():
    a = np.array([0, 0, 10, 10], dtype=np.float32)
    b = np.array([2, 2, 10, 10], dtype=np.float32)
    assert box_iou(a, b) > 0.3
    tr: list[Tracklet] = []
    dets = [Det(0, 0.0, a, 0.9), Det(1, 0.1, b, 0.85)]
    tr, _ = associate_frame(tr, [dets[0]])
    tr, _ = associate_frame(tr, [dets[1]])
    assert len(tr) >= 1


def test_reid_cluster_four_vectors():
    embs = [np.zeros(128) for _ in range(4)]
    for i, e in enumerate(embs):
        e[i * 10] = 1.0
        e /= np.linalg.norm(e)
    tracklets = [Tracklet(tid=i, dets=[Det(0, 0.0, np.array([i, 0, 10, 10]), 0.9)]) for i in range(4)]
    groups = cluster_tracklets(tracklets, embs, total_frames=20)
    assert len(groups) == 4


def test_hungarian_mapping():
    M = np.array([[3.0, 0.1], [0.2, 2.5]])
    m = hungarian_map_speakers(M, min_overlap_s=1.0)
    assert m[0] == 0 and m[1] == 1


def test_director_backchannel_min_shot_and_overlap():
    fps = 10.0
    n = 40
    times = np.linspace(0, 4, n)
    speak = np.zeros((2, n))
    speak[0, :15] = 0.8
    speak[1, 15:35] = 0.85
    speak[0, 35:] = 0.7
    vis = speak.copy()
    words = [
        {"w": "yeah", "s": 1.0, "e": 1.3, "spk": 1},
        {"w": "hello", "s": 2.0, "e": 3.0, "spk": 1},
    ]
    segs = run_director(times, speak, vis, fps, "dynamic", words)
    assert segs
    assert any(s["layout"] in ("close", "two_up", "wide") for s in segs)


def test_smoothing_deadzone_and_cap():
    st = FollowState(x=100.0)
    crop_w = 200.0
    x1 = follow(100.5, 0.1, st, crop_w, dz=0.18, vmax=0.15)
    assert abs(x1 - 100.0) < 1.0
    st2 = FollowState(x=0.0)
    for _ in range(50):
        follow(500.0, 0.1, st2, crop_w, vmax=0.15)
    assert st2.v <= 0.15 * crop_w + 1e-6


def test_crop_v1_v2_parse():
    v1 = {"v": 1, "x0": [1], "shots": [{"start_ms": 0, "end_ms": 1000, "spk": "A"}]}
    assert crop_track_version(v1) == 1
    assert not is_v2_crop_track(v1)
    v2 = {"version": 2, "segments": [{"t0": 0, "t1": 1, "layout": "two_up", "slots": ["P1", "P2"]}]}
    assert is_v2_crop_track(v2)
    shots = v2_to_legacy_shots({**v2, "t0_ms": 0})
    assert shots[0]["spk"] == "split"


def test_filtergraph_strings_exact():
    assert two_up_vstack_filter() == "[s0][s1]vstack=inputs=2"
    assert grid4_xstack_filter() == "[s0][s1][s2][s3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0"
