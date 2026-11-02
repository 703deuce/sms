from urllib.parse import parse_qs, unquote_plus

import pytest

from clips_worker import asr_keyterms
from clips_worker.asr_keyterms import (
    MAX_ASR_KEYTERMS,
    keyterms_from_vocabulary_prefs,
    normalize_keyterms,
    safe_keyterms_for_project,
)
from clips_worker.deepgram_transcribe import _listen_params, deepgram_boost_param_name


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


def test_normalize_keyterms_caps_at_deepgram_limit():
    raw = [f"term{i}" for i in range(MAX_ASR_KEYTERMS + 20)]
    assert len(normalize_keyterms(raw)) == MAX_ASR_KEYTERMS


def test_listen_params_nova3_uses_keyterm():
    assert deepgram_boost_param_name("nova-3") == "keyterm"
    p = _params("en", model="nova-3", keyterms=["Jalen"])
    assert p.get("keyterm") == ["Jalen"]
    assert "keywords" not in p


def test_listen_params_nova2_uses_keywords_not_keyterm():
    assert deepgram_boost_param_name("nova-2") == "keywords"
    p = _params("en", model="nova-2-general", keyterms=["Jalen"])
    assert p.get("keywords") == ["Jalen"]
    assert "keyterm" not in p


def test_listen_params_unknown_model_omits_boost():
    assert deepgram_boost_param_name("some-future-model") is None
    p = _params("en", model="some-future-model", keyterms=["Jalen"])
    assert "keyterm" not in p
    assert "keywords" not in p


def test_listen_params_url_encodes_keyterms():
    q = _listen_params(model="nova-3", language="en", keyterms=["café & co"])
    assert "keyterm=" in q
    assert "café & co" not in q
    p = parse_qs(q)
    assert unquote_plus(p["keyterm"][0]) == "café & co"


def test_safe_keyterms_for_project_fail_open(monkeypatch):
    def boom(_conn, _project):
        raise RuntimeError("db_down")

    monkeypatch.setattr(asr_keyterms, "keyterms_for_project", boom)
    assert safe_keyterms_for_project(None, {"id": "p1"}) == []
