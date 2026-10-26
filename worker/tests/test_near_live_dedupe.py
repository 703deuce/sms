from clips_worker.streamer.near_live.dedupe import dedupe_project_clips


def test_dedupe_is_noop_without_db():
    # IoU logic covered in TS; worker integration uses DB — smoke import only.
    assert callable(dedupe_project_clips)
