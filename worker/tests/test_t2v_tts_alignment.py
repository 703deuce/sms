from clips_worker.t2v.tts_alignment import WORD_BLOCK, duration_ms_from_alignment, words_from_alignment


def test_words_from_alignment_offsets_and_ids():
    alignment = {
        "characters": list("Hi there"),
        "character_start_times_seconds": [0.0, 0.1, 0.2, 0.2, 0.3, 0.4, 0.5, 0.6],
        "character_end_times_seconds": [0.1, 0.2, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
    }
    words = words_from_alignment(alignment, offset_s=2.0, scene_slot=3)
    assert [w["w"] for w in words] == ["Hi", "there"]
    assert words[0]["s"] == 2.0
    assert words[1]["i"] == 3 * WORD_BLOCK + 1
    assert duration_ms_from_alignment(alignment) == 700


def test_empty_alignment_duration():
    assert duration_ms_from_alignment({}) == 0
