from clips_worker.streamer.near_live.chunk import plan_near_live_chunk


def test_plan_waits_for_min_chunk():
    assert plan_near_live_chunk(5 * 60 * 1000, 0) is None


def test_plan_advances_watermark():
    assert plan_near_live_chunk(30 * 60 * 1000, 10 * 60 * 1000) == (600_000, 1_800_000, 1_800_000)
