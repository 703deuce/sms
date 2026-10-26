import os

from clips_worker.job_types import JOB_TYPES
from clips_worker.streamer.lanes import lane_types


def test_default_lane_excludes_stream():
    types = set(lane_types("default"))
    assert "STREAM_ANALYZE" not in types
    assert "PROCESS_PROJECT" in types


def test_stream_lane_only_stream_jobs():
    types = set(lane_types("stream"))
    assert types <= set(JOB_TYPES)
    assert "STREAM_IMPORT" in types
    assert "PROCESS_PROJECT" not in types
