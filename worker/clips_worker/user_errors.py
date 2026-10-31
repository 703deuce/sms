"""Map internal failures to safe user-visible job/project errors."""


class ClipUserError(ValueError):
    """Validation failure safe to show on the project (not retried as infra)."""


BYO_MAX_DURATION_MS = 180_000
BYO_DURATION_MESSAGE = (
    "Bring-your-own clips can be up to 3 minutes. Use Find clips for longer videos."
)

# FV1: "Edit a full video" projects (BYO path, whole source) — same ceiling as URL import.
FULL_VIDEO_MAX_DURATION_MS = 3 * 60 * 60 * 1000
FULL_VIDEO_DURATION_MESSAGE = (
    "Full videos can be up to 3 hours. Trim the file or upload it in parts."
)

_INTERNAL_MARKERS = (
    "on conflict",
    "unique or exclusion constraint",
    "psycopg2",
    "syntax error at",
    "undefined column",
    "undefined table",
    "deadlock detected",
)


USER_FACING_JOB_ERROR_MAX = 1500


def user_facing_job_error(message: str) -> str:
    raw = (message or "").strip()
    if not raw:
        return "Processing failed. Retry processing."
    lower = raw.lower()
    if any(m in lower for m in _INTERNAL_MARKERS):
        return "Processing failed. Retry processing."
    if len(raw) <= USER_FACING_JOB_ERROR_MAX:
        return raw
    # FV4a: ffmpeg failures embed the useful line at the end; head truncation hid EINVAL, etc.
    return raw[-USER_FACING_JOB_ERROR_MAX:]
