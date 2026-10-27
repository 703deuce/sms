from clips_worker.streamer.layout.detect_facecam import MAX_SAMPLES, SAMPLE_INTERVAL_S, _sample_times


def test_sample_times_span_clip():
    times = _sample_times(120.0)
    assert len(times) == MAX_SAMPLES
    assert times[0] == 0.0
    assert times[1] == SAMPLE_INTERVAL_S
    assert times[-1] <= 120.0


def test_sample_times_short_clip():
    times = _sample_times(3.0)
    assert times == [0.0, 2.0]
