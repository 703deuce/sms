from clips_worker.deepgram_transcribe import _listen_params
from clips_worker.silence_trim import filler_word_cuts


def test_filler_words_on_for_en_and_auto():
    assert "filler_words=true" in _listen_params(model="nova-3", language="en")
    assert "filler_words=true" in _listen_params(model="nova-3", language="auto")


def test_punctuated_fillers_cut():
    words = [
        {"w": "Um,", "s": 0.5, "e": 0.8},
        {"w": "uh.", "s": 0.9, "e": 1.2},
        {"w": "hello", "s": 1.3, "e": 1.7},
    ]
    assert len(filler_word_cuts(words)) == 2
