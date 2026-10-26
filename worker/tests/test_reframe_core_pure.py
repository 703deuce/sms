import importlib
import sys


def test_reframe_core_has_no_storage_import():
    mod = importlib.import_module("clips_worker.reframe_core")
    src = open(mod.__file__, encoding="utf-8").read()
    assert "clips_worker.storage" not in src
    assert "psycopg2" not in src


def test_track_faces_shape():
    from clips_worker.reframe_core import track_faces

    out = track_faces("/dev/null", {"duration_s": 2, "fps": 10})
    assert out["track"]
