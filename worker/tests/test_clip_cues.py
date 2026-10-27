from clips_worker.streamer.clip_cues import collect_clip_cue_events, streamer_clip_cue_seconds


def test_streamer_clip_that_phrase():
    words = [{"w": "clip", "s": 10.0, "e": 10.2}, {"w": "that", "s": 10.3, "e": 10.5}]
    sig = streamer_clip_cue_seconds(words, 30)
    assert max(sig) >= 0.85
    assert sig[10] >= 0.85
    assert sig[9] < 0.5


def test_streamer_clip_ignores_non_adjacent_words():
    words = [
        {"w": "clip", "s": 1.0, "e": 1.2},
        {"w": "something", "s": 2.0, "e": 2.2},
        {"w": "that", "s": 10.0, "e": 10.2},
    ]
    sig = streamer_clip_cue_seconds(words, 30)
    assert sig[10] < 0.85


def test_collect_cue_events():
    words = [{"w": "clip it", "s": 5.0, "e": 5.5}]
    events = collect_clip_cue_events(words=words, duration_s=60)
    assert any(e["kind"] == "streamer_call" for e in events)
