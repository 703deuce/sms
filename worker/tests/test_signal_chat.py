from clips_worker.streamer.signals.chat import chat_signal_per_second


def test_chat_burst_peak_after_lag():
    duration_s = 300
    messages = []
    for i in range(200):
        messages.append({"t_s": 120, "user": f"u{i}", "text": "KEKW PogChamp"})
    sig = chat_signal_per_second(messages, duration_s, lag_s=6)
    peak = max(range(duration_s), key=lambda i: sig[i])
    assert 112 <= peak <= 116
    assert sig[peak] >= 0.4
