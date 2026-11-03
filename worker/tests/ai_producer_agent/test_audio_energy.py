import pytest

from clips_worker.ai_producer_agent import audio_energy, inventory_merge, self_review


def test_audio_energy_synthetic():
    out = audio_energy.analyze({"rangeMs": [0, 5000], "hopMs": 5, "returnFrames": True})
    assert out["costUsd"] == 0
    assert isinstance(out["bursts"], list)
    assert out.get("frames")


def test_inventory_merge_callback():
    invs = [
        {"sourceId": "a", "beats": [{"id": "b1", "s": 0, "e": 1, "text": "minecraft creeper"}]},
        {"sourceId": "b", "beats": [{"id": "b2", "s": 0, "e": 1, "text": "creeper minecraft"}]},
    ]
    out = inventory_merge.merge({"inventories": invs})
    assert any(l.get("kind") == "callback" for l in out["links"])


def test_self_review_partial_word():
    edl = {"trim": {"in": 0, "out": 6000}, "cutRanges": [[2500, 2600]]}
    words = [{"w": "hello", "s": 2.0, "e": 3.0}]
    out = self_review.review({"edl": edl, "words": words})
    assert out["passed"] is False
    assert out["issues"][0]["code"] == "partial_word"
