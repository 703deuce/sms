from clips_worker.script_edl import derive_edl, output_duration_ms


def test_derive_edl_deletes_shorten_output():
    document = {
        "v": 1,
        "keptWordIds": ["m:0", "m:1"],
        "deletedWordIds": [],
        "wordOrder": ["m:0", "m:1"],
    }
    words = {
        "m:0": {"id": "m:0", "t0Ms": 0, "t1Ms": 500},
        "m:1": {"id": "m:1", "t0Ms": 2000, "t1Ms": 2500},
    }
    edl = derive_edl(document, words)
    assert output_duration_ms(edl) < 2500
