from urllib.parse import parse_qs

from clips_worker.deepgram_transcribe import _listen_params


def _params(language=None, model=None):
    q = _listen_params(model=model, language=language)
    return parse_qs(q)


def test_listen_params_default_matches_english():
    p = _params("en")
    assert p.get("language") == ["en"]
    assert "detect_language" not in p


def test_listen_params_auto_detect():
    p = _params("auto")
    assert p.get("detect_language") == ["true"]
    assert "language" not in p


def test_listen_params_spanish():
    p = _params("es")
    assert p.get("language") == ["es"]
