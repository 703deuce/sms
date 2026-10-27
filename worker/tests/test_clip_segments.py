from clips_worker.clip_segments import clip_segment_key, span_tuple


def test_clip_segment_key_format():
    assert clip_segment_key(120_000, 185_500) == "120000:185500"
    assert span_tuple(1, 2) == (1, 2)
