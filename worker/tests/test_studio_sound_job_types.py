from clips_worker.job_types import JOB_TYPES
from clips_worker.main import DISPATCH


def test_studio_sound_registered():
    assert "STUDIO_SOUND" in JOB_TYPES
    assert "STUDIO_SOUND" in DISPATCH
