from clips_worker.picker_checkpoint import load_picker_cache


def test_picker_cache_key_mismatch_clears_resume():
    settings = {"genre": "podcast", "prompt": "", "clipLength": "auto"}
    payload = {
        "pickerCache": {
            "key": {"genre": "podcast", "prompt": "", "clipLength": "auto", "rangeStartMs": 0, "rangeEndMs": 1000},
            "pass1Moments": [{"start_sentence": 0, "end_sentence": 1}],
        }
    }
    loaded = load_picker_cache(payload, settings, 0, 2000)
    assert loaded == {}


def test_picker_cache_hit_returns_moments():
    settings = {"genre": "podcast", "prompt": "", "clipLength": "auto"}
    payload = {
        "pickerCache": {
            "key": {"genre": "podcast", "prompt": "", "clipLength": "auto", "rangeStartMs": 0, "rangeEndMs": 240_000},
            "pass1Moments": [{"start_sentence": 0, "end_sentence": 2}],
        }
    }
    loaded = load_picker_cache(payload, settings, 0, 240_000)
    assert len(loaded["pass1Moments"]) == 1
