"""Terminal job failure progress payloads (streamer B3 scope)."""

from clips_worker.user_errors import user_facing_job_error

_STREAM_PIPELINE_FAILURE_TYPES = frozenset(
    {
        "STREAM_IMPORT",
        "STREAM_ANALYZE",
        "STREAM_RENDER",
        "STREAM_AUTOPULL",
    }
)


def terminal_failure_progress_payload(job_type: str, msg: str) -> dict:
    """Progress body for a failed job after retries are exhausted."""
    if job_type in _STREAM_PIPELINE_FAILURE_TYPES:
        return {
            "projectStatus": "FAILED",
            "stage": "failed",
            "progress": 0,
            "error": user_facing_job_error(msg),
            "jobStatus": "FAILED",
        }
    if (job_type or "").startswith("STREAM_"):
        return {"jobStatus": "FAILED"}
    return {
        "projectStatus": "FAILED",
        "stage": "failed",
        "progress": 0,
        "error": user_facing_job_error(msg),
        "jobStatus": "FAILED",
    }
