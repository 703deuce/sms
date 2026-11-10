"""AD_STUDIO_RUN is claimable on the default lane, never in the stream lane."""
from clips_worker.job_types import JOB_TYPES
from clips_worker.streamer.lanes import lane_types


def test_ad_studio_registered_in_default_worker():
    assert "AD_STUDIO_RUN" in JOB_TYPES
    assert "AD_STUDIO_RUN" in lane_types("default")
    assert "AD_STUDIO_RUN" not in lane_types("stream")
