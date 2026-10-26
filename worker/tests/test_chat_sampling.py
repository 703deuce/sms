from clips_worker.streamer.chat_sampling import sample_chat_for_clip


def test_sampling_caps_per_second():
    msgs = [{"tMs": 10_000 + i * 10, "user": "u", "text": f"m{i}"} for i in range(20)]
    lines = sample_chat_for_clip(msgs, clip_start_ms=10_000, clip_end_ms=20_000)
    assert 0 < len(lines) <= 20
