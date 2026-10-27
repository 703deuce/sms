from clips_worker.picker.pass2 import score_moments
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals


def _sentence(idx: int, start: float, end: float, text: str) -> Sentence:
    return Sentence(
        idx=idx,
        start_ms=int(start * 1000),
        end_ms=int(end * 1000),
        speaker="A",
        text=text,
        word_start=idx,
        word_end=idx,
    )


def test_pass2_skips_llm_for_short_source(monkeypatch):
    monkeypatch.setattr(
        "clips_worker.picker.pass2.chat_json",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("LLM should not run")),
    )
    sentences = [_sentence(0, 0, 2, "Hello world"), _sentence(1, 2, 4, "More talk")]
    def sig(idx: int) -> SentenceSignals:
        return SentenceSignals(
            sentence_idx=idx,
            words_per_sec=2.0,
            rms_z=0.1,
            pitch_z=0.0,
            pause_before_ms=0,
            pause_after_ms=200,
            laugh=False,
            overlap=False,
            question=False,
            has_entity=False,
        )

    signals = [sig(0), sig(1)]
    moments = [{"start_sentence": 0, "end_sentence": 1, "why": "test", "archetype": "story"}]
    scored, audit = score_moments(moments, sentences, signals, "podcast", source_duration_s=75.0)
    assert scored
    assert audit == []
