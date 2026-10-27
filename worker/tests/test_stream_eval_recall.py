from clips_worker.streamer.eval_recall import recall_at_k, span_overlap_ratio


def test_overlap_half():
    assert span_overlap_ratio(0, 100, 50, 150) == 0.5


def test_recall_at_10_hits_viewer_clip():
    gt = [{"vod_offset_s": 60, "duration_s": 30}]
    picks = [{"startMs": 55_000, "endMs": 95_000, "score": 90}]
    assert recall_at_k(picks, gt, 10) == 1.0
