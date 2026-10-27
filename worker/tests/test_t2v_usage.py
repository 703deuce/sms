from clips_worker.t2v.usage import elevenlabs_tts_cost_usd_micros


def test_eleven_v4_cost_per_1k_chars():
    # $0.08 / 1k chars => 80_000 micros per 1k
    assert elevenlabs_tts_cost_usd_micros(1000, "eleven_v4") == 80_000
    assert elevenlabs_tts_cost_usd_micros(500, "eleven_v4") == 40_000


def test_cached_voice_skips_zero_chars():
    assert elevenlabs_tts_cost_usd_micros(0, "eleven_v4") == 0
