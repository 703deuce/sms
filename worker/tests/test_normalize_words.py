from clips_worker.gpu.base import normalize_words


def test_normalize_offset_and_shape():
    raw = [{"word": "hi", "start": 1.0, "end": 1.5, "prob": 0.9}]
    out = normalize_words(raw, offset_ms=1000)
    assert out[0]["w"] == "hi"
    assert out[0]["s"] == 2.0
    assert out[0]["e"] == 2.5
    assert out[0]["p"] == 0.9
    assert out[0]["i"] == 0


def test_monotonic_indices():
    raw = [
        {"w": "a", "s": 0.0, "e": 0.1, "p": 1.0},
        {"w": "b", "s": 0.2, "e": 0.3, "p": 1.0},
    ]
    out = normalize_words(raw)
    assert [w["i"] for w in out] == [0, 1]
    assert out[1]["s"] >= out[0]["s"]
