import numpy as np

from clips_worker.crop_format import crop_track_version, is_v2_crop_track, v2_to_legacy_shots
from clips_worker.filtergraph import grid3_layout_filter, grid4_xstack_filter, two_up_vstack_filter


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
    assert (
        grid3_layout_filter()
        == "[s0]scale=1080:960:flags=lanczos[t0];[s1][s2]hstack=inputs=2[bot];[t0][bot]vstack=inputs=2"
    )


def test_shot_cuts_histogram_fallback():
    import sys
    from pathlib import Path

    v3 = Path(__file__).resolve().parents[1] / "prototype" / "v3"
    if not (v3 / "shot_cuts.py").is_file():
        v3 = Path("/app/v3")
    v3_str = str(v3.resolve())
    if v3_str not in sys.path:
        sys.path.insert(0, v3_str)
    from shot_cuts import scene_cut_times

    g0 = np.zeros((64, 64), dtype=np.uint8)
    g1 = np.ones((64, 64), dtype=np.uint8) * 255
    cuts = scene_cut_times("/nonexistent/video.mp4", gray_frames=[g0, g1, g1], times_s=[0.0, 1.0, 2.0])
    assert 0.0 in cuts


def test_reframe_v2_hot_path_wired_in_speakercrop():
    """Live v2: REFRAME_V=2 -> speakercrop_v2 -> clips_worker.reframe_core (not multiperson_pipeline)."""
    from pathlib import Path

    worker_root = Path(__file__).resolve().parents[1]
    v3 = worker_root / "prototype" / "v3"
    if not (v3 / "speakercrop.py").is_file():
        v3 = Path("/app/v3")
    src = (v3 / "speakercrop.py").read_text(encoding="utf-8")
    assert 'os.environ.get("REFRAME_V"' in src
    assert 'strip() == "2"' in src
    assert "speakercrop_v2" in src
    v2 = (v3 / "speakercrop_v2.py").read_text(encoding="utf-8")
    assert "reframe_core" in v2
    assert "multiperson_pipeline" not in v2
    docker = worker_root / "Dockerfile"
    if docker.is_file():
        docker_src = docker.read_text(encoding="utf-8")
        assert "worker/prototype/v3 /app/v3" in docker_src
        assert "test_multiperson_clipper.py" in docker_src
        assert "test_director_calm.py" not in docker_src
        assert "test_prototype_v3_clipper.py" not in docker_src
