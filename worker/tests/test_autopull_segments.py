from clips_worker.streamer.autopull_job import plan_vod_segment_ranges, VOD_SEGMENT_MAX_MS


def test_plan_vod_segment_ranges_short_vod():
    assert plan_vod_segment_ranges(60 * 60_000) == [(0, 60 * 60_000)]


def test_plan_vod_segment_ranges_splits_over_10h():
    total = VOD_SEGMENT_MAX_MS + 2 * 3600_000
    ranges = plan_vod_segment_ranges(total)
    assert len(ranges) == 2
    assert ranges[0] == (0, VOD_SEGMENT_MAX_MS)
    assert ranges[1][1] - ranges[1][0] == 2 * 3600_000
