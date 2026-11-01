from clips_worker.export_progress import RenderProgress, estimate_export_pass_weights


def test_weights_include_deliver_hevc_2160p():
    w = estimate_export_pass_weights({}, {"targetResolution": "2160p", "codec": "hevc"})
    kinds = [k for k, _ in w]
    assert "deliver" in kinds
    deliver_w = next(v for k, v in w if k == "deliver")
    assert deliver_w > 0.4


def test_weighted_snapshot_uses_weights():
    weights = [1.0, 3.0]
    tr = RenderProgress(10.0, 2, pass_weights=weights)
    tr._last_frac = 0.25
    snap = tr.snapshot()
    assert snap["frac"] >= 0.25
    weights = [1.0, 2.0]
    tr = RenderProgress(5.0, 2, pass_weights=weights)
    a = tr.snapshot()["progress"]
    tr._last_frac = 0.5
    b = tr.snapshot()["progress"]
    assert b >= a
