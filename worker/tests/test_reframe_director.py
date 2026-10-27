import numpy as np, pytest
from clips_worker.reframe_core import (DirectorCfg, viterbi_layout, path_segments, speaker_turns,
    map_speakers_to_people, speaker_posterior, smooth_path, OneEuro, assign_people, Tracklet, layout_slots, tile_rect)

FPS = 5.0

def synth(P=2, n=150, turns=((0, 0, 40), (1, 40, 80), (0, 80, 84), (1, 84, 150))):
    """turns: (person, start, end) in samples. Returns post, visible."""
    vis = np.ones((P, n), bool)
    act = np.full((P, n), 0.8)
    t = np.full(n, -1)
    for p, a, b in turns:
        act[p, a:b] = 2.0; t[a:b] = p
    post = speaker_posterior(t, {p: p for p in range(P)}, act, vis)
    return post, vis, t, act

def segs_of(post, vis, **kw):
    cfg = DirectorCfg(sample_fps=FPS, lead_s=0.0, **kw)
    st, path = viterbi_layout(post, vis, cfg)
    T = np.arange(post.shape[1]) / FPS
    return path_segments(st, path, T), st, path

def test_follows_long_turns_and_ignores_blip():
    post, vis, _, _ = synth()
    segs, *_ = segs_of(post, vis, allow_split=False)
    lay = [(s["layout"], s["slots"]) for s in segs]
    assert lay == [("single", [0]), ("single", [1])]        # 0.8 s blip by P1 absorbed
    assert abs(segs[1]["start_s"] - 8.0) <= 0.4

def test_min_hold_respected():
    rng = np.random.default_rng(0)
    turns = []; j = 0
    while j < 300:
        L = int(rng.integers(2, 12)); turns.append((int(rng.integers(0, 2)), j, min(300, j + L))); j += L
    post, vis, _, _ = synth(n=300, turns=turns)
    segs, *_ = segs_of(post, vis, min_hold_s=1.5)
    for s in segs[:-1]:
        assert s["end_s"] - s["start_s"] >= 1.5 - 1e-6

def test_lead_moves_cut_earlier():
    post, vis, _, _ = synth()
    st, p0 = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, lead_s=0.0, allow_split=False))
    st, p1 = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, lead_s=0.4, allow_split=False))
    assert np.argmax(p1 != p1[0]) == np.argmax(p0 != p0[0]) - 2

def test_split_when_both_talk_back_and_forth():
    turns = [(i % 2, a, a + 4) for i, a in enumerate(range(0, 100, 4))]
    post, vis, _, _ = synth(n=100, turns=turns)
    segs, *_ = segs_of(post, vis)
    assert any(s["layout"] == "split" for s in segs)

def test_grid_for_four_way_crosstalk():
    turns = [(i % 4, a, a + 3) for i, a in enumerate(range(0, 120, 3))]
    post, vis, _, _ = synth(P=4, n=120, turns=turns)
    segs, *_ = segs_of(post, vis)
    assert max((s["end_s"] - s["start_s"]) for s in segs if s["layout"] == "grid") > 10

def test_invisible_person_never_single():
    post, vis, _, _ = synth()
    vis[1, 50:70] = False
    _, st, path = segs_of(post, vis)
    assert all(st[k] != ("single", 1) for k in path[50:70])

def test_force_fit_and_split():
    post, vis, _, _ = synth()
    st, path = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, force="fit"))
    assert all(st[k][0] == "wide" for k in path)
    st, path = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, force="split"))
    assert all(st[k][0] == "split" for k in path)

def test_hard_cut_allows_immediate_switch():
    post, vis, _, _ = synth(turns=((0, 0, 50), (1, 50, 53), (0, 53, 150)))
    st, path = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, lead_s=0, allow_split=False, min_hold_s=2.0), cuts=[50])
    assert st[path[49]] == ("single", 0)

def test_speaker_turns_bridge_and_mapping():
    T = np.arange(0, 20, 0.2)
    words = [dict(w="a", s=0.0, e=0.4, spk=1), dict(w="b", s=0.8, e=1.2, spk=1), dict(w="c", s=5.0, e=9.0, spk=0)]
    t = speaker_turns(words, T)
    assert (t[(T > 0.4) & (T < 0.8)] == 1).all() and t[int(3 / 0.2)] == -1
    act = np.ones((2, len(T))); act[1, t == 1] = 2.5; act[0, t == 0] = 2.5   # deepgram 1 = person 1
    assert map_speakers_to_people(t, act, np.ones_like(act, bool)) == {1: 1, 0: 0}

def test_offscreen_voice_maps_to_none():
    T = np.arange(0, 20, 0.2); n = len(T)
    t = np.where(T < 10, 0, 1)                    # spk 1 = off-screen narrator
    act = np.ones((1, n)); act[0, T < 10] = 2.5
    m = map_speakers_to_people(t, act, np.ones((1, n), bool))
    assert m == {0: 0}
    post = speaker_posterior(t, m, act, np.ones((1, n), bool))
    assert post[1, T >= 10].mean() > 0.8          # 'none' row dominates

def test_one_euro_and_pan_cap():
    fps = 30; W = 1280
    x = np.r_[np.full(30, 300.0), np.full(150, 900.0)] + np.random.default_rng(1).normal(0, 6, 180)
    y = smooth_path(x, fps, frame_w=W, max_speed=0.15)
    assert np.abs(np.diff(y)).max() <= 0.15 * W / fps + 1e-6
    still = smooth_path(np.full(90, 500.0) + np.random.default_rng(2).normal(0, 8, 90), fps, frame_w=W)
    assert np.ptp(still) < 3                       # dead-zone kills jitter
    y2 = smooth_path(x, fps, frame_w=W, resets=[30])
    assert abs(y2[30] - x[30]) < 1e-6              # layout cut = jump, not pan

def _tl(tid, shot, start, n, emb, x=100):
    return Tracklet(tid=tid, shot=shot, idx=list(range(start, start + n)), boxes=[[x, 0, 50, 50]] * n, embs=[emb] * 3)

def test_reid_gallery_hungarian_and_cannot_link():
    rng = np.random.default_rng(0)
    A, B = [v / np.linalg.norm(v) for v in rng.normal(size=(2, 128))]
    noisy = lambda v: (lambda u: u / np.linalg.norm(u))(v + rng.normal(0, 0.02, 128))
    tls = [_tl(1, 0, 0, 50, noisy(A), 100), _tl(2, 0, 0, 50, noisy(B), 800),
           _tl(3, 1, 50, 40, noisy(B)), _tl(4, 2, 90, 60, noisy(A), 100), _tl(5, 2, 90, 60, noisy(B), 800)]
    m = assign_people(tls)
    assert m[1] == m[4] and m[2] == m[3] == m[5] and m[1] != m[2]
    # two tracklets at the same time with the same face can't be one person
    m2 = assign_people([_tl(1, 0, 0, 20, A), _tl(2, 0, 0, 20, noisy(A), 600)])
    assert m2[1] != m2[2]

def test_layout_geometry():
    assert sum(h for *_, h in layout_slots("split", 1080, 1920, 2)) == 1920
    g = layout_slots("grid", 1080, 1920, 4); assert len(g) == 4 and g[3] == (540, 960, 540, 960)
    x, y, w, h = tile_rect(1200, 100, 120, 1280, 720, 9 / 8)
    assert 0 <= x and x + w <= 1280 and 0 <= y and y + h <= 720


def test_frame_crops_three_side_pip():
    from clips_worker.reframe_core import compose_frame, frame_crops

    nfr = 30
    track = {
        "W": 1280,
        "H": 720,
        "cw": 400,
        "fps": 30.0,
        "out_w": 1080,
        "out_h": 1920,
        "x0": [-1] * nfr,
        "people": [{"id": "P1", "screen_s": 10}, {"id": "P2", "screen_s": 8}, {"id": "P3", "screen_s": 6}],
        "segments": [
            {"layout": "three", "slots": [0, 1, 2], "start_s": 0.0, "end_s": 1.0},
        ],
        "_frames": {
            "fx": np.full((3, nfr), 640.0),
            "fy": np.full((3, nfr), 360.0),
            "fh": np.full((3, nfr), 120.0),
            "seg_of": np.zeros(nfr, int),
        },
    }
    lay, crops = frame_crops(track, 5)
    assert lay == "three" and len(crops) == 3
    fr = np.zeros((720, 1280, 3), np.uint8)
    out = compose_frame(fr, lay, crops, 1080, 1920)
    assert out.shape == (1920, 1080, 3)

    track["segments"][0] = {"layout": "side", "slots": [0, 1], "start_s": 0.0, "end_s": 1.0}
    lay, crops = frame_crops(track, 5)
    assert lay == "side" and len(crops) == 2
    out = compose_frame(fr, lay, crops, 1080, 1920)
    assert out.shape == (1920, 1080, 3)

    track["segments"][0] = {"layout": "pip", "slots": [1], "start_s": 0.0, "end_s": 1.0}
    lay, crops = frame_crops(track, 5)
    assert lay == "pip" and len(crops) == 1
    out = compose_frame(fr, lay, crops, 1080, 1920)
    assert out.shape == (1920, 1080, 3)
