from clips_worker.ai_producer_agent.finder.watch import plan_upload_watch_ranges, resolve_video_picker_stream_ranges


def test_short_upload_stays_one_watch():
    assert plan_upload_watch_ranges(0, 19 * 60_000) == [(0, 19 * 60_000)]
    assert resolve_video_picker_stream_ranges(1_200_000) == [(0, 1_200_000)]


def test_hour_long_interview_is_chunked_invisibly():
    ranges = plan_upload_watch_ranges(0, 3_931_162)
    assert ranges[0][0] == 0
    assert ranges[-1][1] == 3_931_162
    assert len(ranges) >= 3
    # Adjacent slices cover the whole authorized file with no gap larger than overlap.
    covered = ranges[0][0], ranges[-1][1]
    assert covered == (0, 3_931_162)
