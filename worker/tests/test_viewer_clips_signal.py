from clips_worker.streamer.signals.viewer_clips import viewer_clips_signal_per_second


def test_viewer_clips_peak_near_offset():
    clips = [{"vod_offset_s": 100, "duration_s": 20, "view_count": 500}]
    sig = viewer_clips_signal_per_second(clips, 300)
    peak = max(range(300), key=lambda i: sig[i])
    assert 95 <= peak <= 115
    assert sig[peak] >= 0.5
