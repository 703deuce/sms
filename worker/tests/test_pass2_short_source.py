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


def _sig(idx: int) -> SentenceSignals:
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


def test_short_source_uses_single_batched_pass2(monkeypatch):
    calls: list[str] = []

    def fake_chat(system: str, user: str, schema: dict, name: str, **kwargs) -> dict:
        calls.append(name)
        assert name == "moments_pass2_batch"
        assert "moment_index" in user
        return {
            "clips": [
                {
                    "moment_index": 0,
                    "start_id": 0,
                    "end_id": 1,
                    "payoff_id": 1,
                    "archetype": "story",
                    "scores": {
                        "hook": 7,
                        "self_contained": 7,
                        "payoff": 7,
                        "energy": 6,
                        "value": 6,
                    },
                    "reject": False,
                    "reject_reason": "",
                    "title": "Hello world moment",
                    "why_care": "Strong opener",
                }
            ]
        }

    monkeypatch.setattr("clips_worker.picker.pass2.chat_json", fake_chat)
    sentences = [_sentence(0, 0, 2, "Hello world"), _sentence(1, 2, 4, "More talk")]
    signals = [_sig(0), _sig(1)]
    moments = [{"start_sentence": 0, "end_sentence": 1, "why": "test", "archetype": "story"}]
    scored, _audit = score_moments(moments, sentences, signals, "podcast", source_duration_s=75.0)
    assert len(calls) == 1
    assert scored
    assert scored[0]["title"] == "Hello world moment"


def test_short_source_batch_falls_back_on_error(monkeypatch):
    monkeypatch.setattr(
        "clips_worker.picker.pass2.chat_json",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("timeout")),
    )
    sentences = [_sentence(0, 0, 2, "Hello world"), _sentence(1, 2, 4, "More talk")]
    signals = [_sig(0), _sig(1)]
    moments = [{"start_sentence": 0, "end_sentence": 1, "why": "test", "archetype": "story"}]
    scored, audit = score_moments(moments, sentences, signals, "podcast", source_duration_s=60.0)
    assert scored
    assert audit == []
