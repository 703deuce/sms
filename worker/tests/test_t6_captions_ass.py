import copy

from clips_worker.caption_presets import PRESETS, resolve_preset
from clips_worker.captions_ass import build_ass
from pathlib import Path


def test_build_ass_does_not_mutate_shared_preset(tmp_path):
    before = copy.deepcopy(PRESETS["bold_pop"])
    words = [{"w": "hi", "s": 0.0, "e": 0.4, "i": 0}]
    build_ass(
        words,
        {"presetId": "bold_pop", "presetConfig": {"outlineW": 99}},
        tmp_path / "t.ass",
    )
    assert PRESETS["bold_pop"]["outlineW"] == before["outlineW"]
