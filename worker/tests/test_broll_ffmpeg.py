from clips_worker.broll_render import build_broll_filtergraph


def test_broll_filtergraph_two_items():
    specs = [
        {"local_path": "/tmp/a.mp4", "start_s": 2.0, "end_s": 5.0, "duration_s": 8.0},
        {"local_path": "/tmp/b.mp4", "start_s": 8.0, "end_s": 11.0, "duration_s": 6.0},
    ]
    fc, extra, label = build_broll_filtergraph(specs, 720, 1280)
    assert "overlay=0:0:enable='between(t,2.000,5.000)'" in fc
    assert "overlay=0:0:enable='between(t,8.000,11.000)'" in fc
    assert label == "v1"
    assert extra.count("-stream_loop") == 2
    print(fc)
