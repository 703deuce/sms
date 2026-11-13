from clips_worker.t2v.feature_gate import T2V_JOB_TYPES
from clips_worker.t2v.job import _pipeline_canvas
from clips_worker.t2v.verify_stock import _clamp_window, _host_allowed


def test_verify_job_is_gated_t2v_type():
    assert "T2V_VERIFY_STOCK" in T2V_JOB_TYPES


def test_window_grows_to_needed_length_inside_clip():
    assert _clamp_window({"in_s": 2, "out_s": 3}, 10, 5) == (0.0, 5.0)
    assert _clamp_window({"in_s": 8, "out_s": 9.5}, 10, 4) == (6, 10)


def test_window_clamped_to_clip_bounds():
    a, b = _clamp_window({"in_s": -3, "out_s": 99}, 12, 4)
    assert a == 0.0 and b == 12


def test_preview_hosts_allowlisted():
    assert _host_allowed("https://cdn.pixabay.com/video/x.mp4")
    assert not _host_allowed("http://cdn.pixabay.com/video/x.mp4")
    assert not _host_allowed("https://evil.example.com/x.mp4")


def test_pipeline_canvas_only_when_requested():
    assert _pipeline_canvas({"autobuild": {"assembleResolution": "480p"}}, "16:9", 1920, 1080) == (854, 480)
    # Export resolution alone must not shrink the assembled source.
    assert _pipeline_canvas({"autobuild": {"renderResolution": "480p"}}, "16:9", 1920, 1080) == (1920, 1080)
    assert _pipeline_canvas({}, "16:9", 1920, 1080) == (1920, 1080)
