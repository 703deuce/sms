from clips_worker.job_types import JOB_TYPES


def test_studio_sound_registered():
    assert "STUDIO_SOUND" in JOB_TYPES
