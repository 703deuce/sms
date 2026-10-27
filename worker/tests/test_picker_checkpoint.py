from clips_worker.picker_checkpoint import load_picker_cache, save_picker_cache


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


def test_save_picker_cache_merges_pass1():
    class Cur:
        def __init__(self):
            self.payload = "{}"

        def execute(self, sql, args=None):
            if "SELECT payload" in sql:
                self.row = (self.payload,)
            elif "UPDATE" in sql:
                self.payload = args[0]

        def fetchone(self):
            return getattr(self, "row", ("{}",))

    class Conn:
        def cursor(self):
            return Cur()

        def commit(self):
            pass

    conn = Conn()
    out = save_picker_cache(
        conn,
        "job_1",
        {},
        {"genre": "interview"},
        0,
        240_000,
        moments=[{"start_sentence": 0, "end_sentence": 2}],
    )
    assert out["resume"] is True
    assert len(out["pickerCache"]["pass1Moments"]) == 1
