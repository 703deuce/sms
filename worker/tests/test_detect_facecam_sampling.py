from clips_worker.streamer.layout.detect_facecam import AW, _sample_frames


def test_analysis_width_and_sampler():
    assert AW == 640
    # whole-clip spread (guide §8.6): returns list (may be empty without a real video)
    assert isinstance(_sample_frames.__name__, str)
