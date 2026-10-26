from clips_worker.job_types import JOB_TYPES


def test_stream_import_in_job_types():
    assert "STREAM_IMPORT" in JOB_TYPES
