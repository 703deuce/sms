from clips_worker.reason_tag import clip_reason_ai_meta, reason_tag, words_per_second


def test_reason_tag_thresholds():
    assert reason_tag({"videoMomentMatchIou": 0.5}, 0.5) == "visual"
    assert reason_tag({"videoMomentMatchIou": 0.5}, 1.0) == "both"
    assert reason_tag({"videoMomentMatchIou": 0.1}, 2.0) == "speech"


def test_anything_mode():
    assert reason_tag({}, 0.2, "anything") == "visual"
    assert reason_tag({}, 2.0, "anything") == "both"


def test_clip_reason_ai_meta():
    pick = {"start_ms": 0, "end_ms": 10_000, "aiMeta": {"videoMomentMatchIou": 0.4}}
    words = [{"s": 0.5, "e": 1.0}, {"s": 1.0, "e": 1.5}]
    meta = clip_reason_ai_meta(pick, words, "regular")
    assert meta["reasonTag"] in ("visual", "both", "speech")
    assert "wordsPerSec" in meta


def test_words_per_second():
    wps = words_per_second([{"s": 0, "e": 1}, {"s": 1, "e": 2}], 0, 2000)
    assert wps == 1.0
