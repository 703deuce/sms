from urllib.parse import parse_qs

from clips_worker.asr_keyterms import keyterms_from_vocabulary_prefs, normalize_keyterms
from clips_worker.deepgram_transcribe import _listen_params


def _params(language=None, model=None, keyterms=None):
    q = _listen_params(model=model, language=language, keyterms=keyterms)
    return parse_qs(q)


def test_listen_params_default_matches_english():
    p = _params("en")
    assert p.get("language") == ["en"]
    assert p.get("filler_words") == ["true"]
    assert "detect_language" not in p


def test_listen_params_auto_detect():
    p = _params("auto")
    assert p.get("detect_language") == ["true"]
    assert "language" not in p


def test_listen_params_spanish():
    p = _params("es")
    assert p.get("language") == ["es"]


def test_listen_params_keyterms():
    p = _params("en", keyterms=["Jalen", "Rodgers"])
    assert p.get("keyterm") == ["Jalen", "Rodgers"]


def test_keyterms_from_vocabulary_prefs():
    terms = keyterms_from_vocabulary_prefs(
        {"vocabulary": [{"from": "jaylen", "to": "Jalen"}, {"from": "x", "to": "Yo"}]}
    )
    assert terms[0] == "Jalen"
    assert "Yo" in terms


def test_normalize_keyterms_dedupes():
    assert normalize_keyterms(["Alpha", "alpha", "Beta"]) == ["Alpha", "Beta"]
