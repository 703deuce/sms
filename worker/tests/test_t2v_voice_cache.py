from clips_worker.t2v.keys import voice_storage_key


def test_voice_storage_key_matches_new_app():
    h = "abc123" * 10 + "abcd"
    assert voice_storage_key(h) == f"t2v/voice/{h}.mp3"
